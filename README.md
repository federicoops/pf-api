# Personal Finance API

FastAPI + MongoDB server for expense, accounting and investment tracking.
It suits most of my needs of net worth trackin, but it may miss something useful for you.

### Quick startup in dev mode
Adjust the env file in `env/.env.example` by creating a new secret key for the oauth authentication. 
You can create the secret key and copy it to the env file:

```bash
$ openssl rand -hex 32
67abc7949f0f66665fc96232283067b09897d89eff9073d0623955d2e3bbc421
```

The env file should look like this (change root user and example password according to the mongodb launch parameters `MONGO_INITDB_ROOT_USERNAME` `MONGO_INITDB_ROOT_PASSWORD` in the script file):

```bash
MONGO_URI=mongodb://root:example@pf-db:27017
MONGO_DB=pf-api
SECRET_KEY=67abc7949f0f66665fc96232283067b09897d89eff9073d0623955d2e3bbc421
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
MONGO_USERNAME=root
MONGO_PASSWORD=example
```


Launch the `start.sh` or `start.ps1` scripts to boot the mongodb and fastapi servers.
The fastapi server will expose a web interface on http://localhost:8000/app/

Create the web user with: 

```bash
docker exec -it pf-api python restore.py -u
```

It will prompt for your username and password and create the user on the database (the password will be stored using a secure hash).

Once the user has been created you can start using the app.

