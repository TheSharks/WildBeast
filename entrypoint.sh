#!/bin/bash

exec npm run-script dbcreate
exec node ./index.js