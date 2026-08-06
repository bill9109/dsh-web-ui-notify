import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Full Settings-row props. */
export type NotificationSettingsRowProps = PropsRuntime<'settings.general.item'> & PropsLocale<'web-ui-notify'>;
/** One of the browser Notification permission states, 'unsupported' when the API is absent. */
export type NotificationPermissionState = NotificationPermission | 'unsupported';
/** Read the current browser permission state (safe outside browsers). */
export declare function permissionState(): NotificationPermissionState;
/**
 * Render the desktop-notification permission row: current browser state plus
 * a request button (the user-gesture entry point the browser requires before
 * `new Notification` works).
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export declare function NotificationSettingsRow({ t }: NotificationSettingsRowProps): import("react").JSX.Element;
