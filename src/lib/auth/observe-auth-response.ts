import {notifyLocalAuthRequired} from '@/lib/auth/local-auth-events';

export function observeAuthResponse(response: Response): void {
  if (response.status === 401) {
    notifyLocalAuthRequired();
  }
}
