module.exports = {
  apps: [
    {
      name: "consultavip",
      cwd: "/var/www/consultavip",
      script: "pnpm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
