module.exports = {
  apps: [
    {
      name: "backend",
      script: "server.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
    },
  ],
};
