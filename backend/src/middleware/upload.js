
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Private storage: these files must not be served as public static files.
const SIGNATURE_DIRECTORY = path.resolve(
  __dirname,
  "../../uploads/signatures"
);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

// Accept PNG and JPEG only. The image bytes are verified again below.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ["image/png", "image/jpeg"];

    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error("Upload a PNG or JPEG signature image.");
      error.statusCode = 400;
      return callback(error);
    }

    callback(null, true);
  },
});

// The frontend must send the image in a FormData field named "signature".
export const uploadSignature = upload.single("signature");

// Verify the actual file bytes instead of trusting the filename or MIME type.
function detectImageType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }

  return null;
}

// Save a validated image under a randomly generated filename.
// Store only the returned filename in PostgreSQL, never a user-supplied path.
export async function saveSignatureImage(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error("A signature image is required.");
    error.statusCode = 400;
    throw error;
  }

  if (file.buffer.length === 0 || file.buffer.length > MAX_FILE_SIZE) {
    const error = new Error("The signature image must be between 1 byte and 2 MB.");
    error.statusCode = 400;
    throw error;
  }

  const imageType = detectImageType(file.buffer);

  if (!imageType) {
    const error = new Error("The uploaded file is not a valid PNG or JPEG image.");
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(SIGNATURE_DIRECTORY, { recursive: true });

  const filename = `${crypto.randomUUID()}.${imageType}`;
  const destination = path.join(SIGNATURE_DIRECTORY, filename);

  await fs.writeFile(destination, file.buffer, { flag: "wx" });

  return filename;
}

// Build a safe path for a previously stored generated filename.
export function getSignatureImagePath(filename) {
  if (
    typeof filename !== "string" ||
    !/^[a-f0-9-]{36}\.(png|jpg)$/.test(filename)
  ) {
    const error = new Error("Invalid signature image reference.");
    error.statusCode = 400;
    throw error;
  }

  return path.join(SIGNATURE_DIRECTORY, filename);
}

// Remove a generated signature file if a later database operation fails.
export async function deleteSignatureImage(filename) {
  const imagePath = getSignatureImagePath(filename);

  try {
    await fs.unlink(imagePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
