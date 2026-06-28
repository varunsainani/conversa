/** Error carrying an i18n key (namespace `errors`) for localized surfacing. */
export class ActionError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "ActionError";
    this.code = code;
  }
}
