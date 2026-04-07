module.exports = {
  apps: [{
    name: "gateway-worker",
    script: "index.js",
    restart_delay: 5000,
    max_restarts: 10,
    env: {
      NODE_ENV: "production"
    }
  }]
}
