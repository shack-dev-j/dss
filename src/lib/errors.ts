/** An error that maps directly to an HTTP status (thrown from routes and the data layer). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
