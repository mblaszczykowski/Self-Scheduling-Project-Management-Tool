## How to run?

#### Backend
##### Create a database
```
psql -U postgres
CREATE DATABASE flowlink;
GRANT ALL PRIVILEGES ON DATABASE "flowlink" TO postgres;
```

#### Web
```
cd frontend
npm install
npm start
```
Make sure frontend runs on default port 3000.
