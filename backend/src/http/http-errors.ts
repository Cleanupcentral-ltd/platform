export interface HttpErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;

  readonly details?: Readonly<
    Record<string, unknown>
  >;
}

/**
 * An error that is safe for the HTTP layer to translate
 * into a public response.
 */
export class HttpError extends Error {
  readonly code: string;
  readonly statusCode: number;

  readonly details?: Readonly<
    Record<string, unknown>
  >;

  constructor(options: HttpErrorOptions) {
    super(options.message);

    this.name = "HttpError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    
    if (options.details !== undefined) {
  this.details = options.details;
}
  }
}