module.exports = {
  apps: [
    {
      name: 'jetrique-website',
      script: 'npm',
      args: 'start',
      cwd: '/home/repo/website',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    }
  ]
};