
import multer from "multer";

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  // Convert upload errors into appropriate client-facing responses.
  if (error instanceof multer.MulterError) {
    const fileTooLarge = error.code === "LIMIT_FILE_SIZE";

    return res.status(fileTooLarge ? 413 : 400).json({
      success: false,
      message: fileTooLarge
        ? "The signature image must not exceed 2 MB."
        : "The uploaded file or form exceeds the allowed limits.",
    });
  }

  // Support both Express-style status and custom statusCode properties.
  const statusCode = error.status || error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  res.status(isClientError ? statusCode : 500).json({
    success: false,
    message: isClientError
      ? error.message
      : "An unexpected server error occurred",
  });
}
