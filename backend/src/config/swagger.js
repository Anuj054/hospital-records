import swaggerJSDoc from "swagger-jsdoc";

// Computed lazily (glob + parse every route file's JSDoc) since it's only
// needed by the rare /api-docs request — paying that cost on every cold
// start/import would slow down every other API call for nothing.
let cached = null;

export function getSwaggerSpec() {
  if (!cached) {
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
