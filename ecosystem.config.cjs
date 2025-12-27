module.exports = {
  apps: [
    {
      name: 'belote-game',
      port: 3000,
      exec_mode: 'fork',
      instances: 1,
      script: './.output/server/index.mjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
}
