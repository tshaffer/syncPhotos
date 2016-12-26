module.exports = {

  entry: './app.js',
  target: 'node',
  output: {
    path: './build',
    filename: 'bundle.js'
  },
  devtool: "source-map",
  module: {
    preLoaders: [
      {
        test: /\.jsx$|\.js$/,
        loader: 'eslint-loader',
        include: __dirname + '/src',
        exclude: /build\.js$/
      }
    ],
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['es2015']
        }
      },
      {
        test: /\.json?$/,
        loader: 'json'
      }
    ]
  },
  // node: {
  //   console: true,
  //   fs: 'empty',
  //   net: 'empty',
  //   tls: 'empty'
  // }
}
