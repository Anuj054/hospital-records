// Both the spec and the swagger-jsdoc dependency itself are loaded lazily:
// generating the spec globs and parses every route file's JSDoc, and the
// library pulls in a sizeable dependency tree. Only /api-docs needs either,
// so keeping them off the module graph shortens every cold start.
let cached = null;

export async function getSwaggerSpec() {
  if (!cached) {
    const { default: swaggerJSDoc } = await import("swagger-jsdoc");
    cached = swaggerJSDoc({
      definition: {
        openapi: "3.0.0",
        info: {
          title: "Hospital Records API",
          version: "1.0.0",
          description: "API for managing patients, bills, medicines, services and reports.",
        },
        components: {
          securitySchemes: {
            cookieAuth: { type: "apiKey", in: "cookie", name: "token" },
          },
        },
        security: [{ cookieAuth: [] }],
      },
      apis: ["./src/routes/*.js"],
    });
  }
  return cached;
}
