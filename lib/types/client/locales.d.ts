/** `web-ui-notify` namespace dictionaries. */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'settings.title': string;
    'settings.description': string;
    'settings.status.granted': string;
    'settings.status.denied': string;
    'settings.status.default': string;
    'settings.status.unsupported': string;
    'settings.request': string;
    'notify.approval.title': string;
    'notify.approval.body': string;
    'notify.question.title': string;
    'notify.question.bodyGeneric': string;
    'notify.turn.title': string;
    'notify.turn.body': string;
};
/** The web-ui-notify namespace key union. */
export type NotifyKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'settings.title': string;
    'settings.description': string;
    'settings.status.granted': string;
    'settings.status.denied': string;
    'settings.status.default': string;
    'settings.status.unsupported': string;
    'settings.request': string;
    'notify.approval.title': string;
    'notify.approval.body': string;
    'notify.question.title': string;
    'notify.question.bodyGeneric': string;
    'notify.turn.title': string;
    'notify.turn.body': string;
};
/** Dictionary namespace owned by this plugin. */
export declare const NS = "web-ui-notify";
