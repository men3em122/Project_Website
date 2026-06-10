import { isAxiosError } from 'axios';

export function getApiErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const message = err.response?.data?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    if (!err.response) {
      return 'Unable to reach the server. Make sure the backend is running on port 5000.';
    }
    return 'Something went wrong. Please try again.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
