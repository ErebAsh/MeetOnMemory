/**
 * File upload helpers with size validation
 */

// Format file size for display
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Get upload limits from server
export const getUploadLimits = async (api) => {
  try {
    const response = await api.get("/meetings/upload-limits");
    return response.data.data;
  } catch (error) {
    console.error("Failed to fetch upload limits:", error);
    // Return default limits if API fails
    return {
      recording: {
        maxSize: 500 * 1024 * 1024,
        maxSizeFormatted: "500 MB",
        allowedTypes: ["video/mp4", "video/webm", "audio/mp3", "audio/wav"],
      },
      audio: {
        maxSize: 100 * 1024 * 1024,
        maxSizeFormatted: "100 MB",
        allowedTypes: ["audio/mpeg", "audio/wav", "audio/aac"],
      },
      chunk: {
        maxSize: 100 * 1024 * 1024,
        maxSizeFormatted: "100 MB",
      },
      transcript: {
        maxSize: 50 * 1024 * 1024,
        maxSizeFormatted: "50 MB",
        allowedTypes: ["text/plain", "application/json", "application/pdf"],
      },
    };
  }
};

// Validate file size before upload
export const validateFileSize = (file, maxSize, type = "File") => {
  if (file.size > maxSize) {
    const error = new Error(
      `${type} size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${formatFileSize(maxSize)}`,
    );
    error.code = "FILE_TOO_LARGE";
    error.maxSize = maxSize;
    error.fileSize = file.size;
    return { valid: false, error };
  }
  return { valid: true, error: null };
};

// Validate file type
export const validateFileType = (file, allowedTypes) => {
  if (!allowedTypes.includes(file.type)) {
    const error = new Error(
      `File type "${file.type}" is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
    );
    error.code = "FILE_TYPE_NOT_ALLOWED";
    return { valid: false, error };
  }
  return { valid: true, error: null };
};

// Comprehensive file validation
export const validateFile = (file, options = {}) => {
  const {
    maxSize = 500 * 1024 * 1024,
    allowedTypes = ["video/mp4", "video/webm", "audio/mpeg"],
    type = "File",
  } = options;

  // Size validation
  const sizeCheck = validateFileSize(file, maxSize, type);
  if (!sizeCheck.valid) return sizeCheck;

  // Type validation
  if (allowedTypes.length > 0) {
    const typeCheck = validateFileType(file, allowedTypes);
    if (!typeCheck.valid) return typeCheck;
  }

  return { valid: true, error: null };
};

// Upload file with progress tracking
export const uploadFileWithProgress = async (
  file,
  uploadUrl,
  onProgress,
  options = {},
) => {
  const {
    maxSize = 500 * 1024 * 1024,
    allowedTypes = [],
    additionalData = {},
  } = options;

  // Validate file
  const validation = validateFile(file, { maxSize, allowedTypes });
  if (!validation.valid) {
    throw validation.error;
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress, event.loaded, event.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(error);
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.open("POST", uploadUrl);

    // Add auth token
    const token = localStorage.getItem("clerk_token");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    // Prepare form data
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    xhr.send(formData);
  });
};

// Check if file size is acceptable for recording
export const isRecordingSizeAcceptable = (
  fileSize,
  maxSize = 500 * 1024 * 1024,
) => {
  return fileSize <= maxSize;
};

// Get user-friendly size warning
export const getSizeWarning = (fileSize, maxSize) => {
  if (fileSize > maxSize) {
    return `File is too large (${formatFileSize(fileSize)}). Maximum allowed: ${formatFileSize(maxSize)}`;
  }
  if (fileSize > maxSize * 0.9) {
    return `File is approaching the maximum size limit (${formatFileSize(fileSize)} / ${formatFileSize(maxSize)})`;
  }
  return null;
};
