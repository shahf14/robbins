export function badRequest(error: string): Response {
  return Response.json({error}, {status: 400});
}

export function serverError(error: string): Response {
  return Response.json({error}, {status: 500});
}

export function notFound(error = 'Not found'): Response {
  return Response.json({error}, {status: 404});
}

export function payloadTooLarge(error = 'Payload too large'): Response {
  return Response.json({error}, {status: 413});
}

export function tooManyRequests(error = 'Too many requests'): Response {
  return Response.json({error}, {status: 429});
}
