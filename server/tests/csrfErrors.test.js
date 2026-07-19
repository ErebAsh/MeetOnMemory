import { jest } from "@jest/globals";
import {
  buildCsrfInvalidResponse,
  CSRF_INVALID,
  CSRF_INVALID_MESSAGE,
  sendCsrfInvalid,
} from "../utils/csrfErrors.js";
import errorHandler from "../middleware/errorHandler.js";

describe("CSRF error responses", () => {
  it("builds the standardized CSRF_INVALID payload", () => {
    expect(buildCsrfInvalidResponse()).toEqual({
      success: false,
      code: CSRF_INVALID,
      message: CSRF_INVALID_MESSAGE,
    });
  });

  it("sends a 403 CSRF_INVALID response", () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    sendCsrfInvalid(res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "CSRF_INVALID",
      message: "CSRF token validation failed.",
    });
  });

  it("maps EBADCSRFTOKEN through the global error handler", () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    errorHandler({ code: "EBADCSRFTOKEN" }, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "CSRF_INVALID",
      message: "CSRF token validation failed.",
    });
  });
});
