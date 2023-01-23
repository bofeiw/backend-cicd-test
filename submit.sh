#!/bin/bash
name=rowy-backend
project_id=rowy-service-dev
yarn
npx tsc
npm run build
gcloud config set project $project_id
gcloud builds submit --tag gcr.io/$project_id/$name
