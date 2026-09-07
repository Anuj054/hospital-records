import swaggerJSDoc from "swagger-jsdoc";

const swaggerSpec = swaggerJSDoc({
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

export default swaggerSpec;
