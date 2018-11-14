#!/usr/bin/env node

'use strict'

const assert = require('assert')
const Activities = require('strava-activities-stream')
const sade = require('sade')
const moment = require('moment')
const get = require('simple-get')
const through = require('through2')
const pkg = require('./package.json')

const cli = sade(pkg.name)

cli
  .version(pkg.version)
  .option('-t, --token', 'A Strava API token')

cli
  .command('run')
  .describe('Set all private activities to public')
  .option('-a, --after', 'Date when updates will begin', moment().subtract(1, 'years').toDate())
  .option('-b, --before', 'Date when updates will end', moment().subtract(2, 'days').toDate())
  .action(options => {
    assert(options.token, 'token is required')

    new Activities({
      token: options.token,
      after: options.after,
      before: options.before
    })
      .pipe(through.obj(function (activity, enc, callback) {
        if (!activity.private) {
          console.log(JSON.stringify({ message: 'skip', id: activity.id }))
          return callback()
        }
        callback(null, activity)
      }))
      .pipe(through.obj(function (activity, enc, callback) {
        console.log(JSON.stringify({ message: 'updating', id: activity.id }))
        const request = {
          method: 'PUT',
          url: 'https://www.strava.com/api/v3/activities/' + activity.id,
          headers: {
            authorization: 'Bearer ' + options.token
          },
          body: { private: false },
          json: true
        }

        get(request, function (err, res) {
          if (err) return callback(err)
          if (res.statusCode >= 299) return callback(new Error('Received ' + res.statusCode))
          callback(null, JSON.stringify({ message: 'updated', id: activity.id, private: false }) + '\n')
        })
      }))
      .pipe(process.stdout)
  })

cli.parse(process.argv)
