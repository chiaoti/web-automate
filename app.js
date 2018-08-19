var express = require('express')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var automateRouter = require('./router')

var app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(bodyParser.json())

app.use('/automate', automateRouter('specs/', 'data/automate.db'))

module.exports = app
