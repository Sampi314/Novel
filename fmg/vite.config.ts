export default {
    root: './src',
    base: process.env.NODE_ENV === 'production' ? '/fmg/' : '/',
    build: {
        outDir: '../dist',
        assetsDir: './',
    },
    publicDir: '../public',
    server: {
        port: 5174,
        strictPort: true,
    },
}
