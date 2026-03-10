module.exports = {
  apps: [{
    name: "sales-admin-server",
    script: "./server/index.ts",
    interpreter: "node",
    interpreter_args: "--import tsx",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      HTTPS_PORT: 3443
    }
  }]
}
