# Run Mathfinder with Docker

From the repository root, build and start the app:

```sh
docker compose up --build -d
```

Open http://localhost:5173. To stop it, run `docker compose down`.
Node builds the app, then Nginx serves the built files on container port 5173.
Character and campaign URLs support direct navigation and refresh.

## Image name and sharing

The Compose image name is `joshdabomb/mathfinder-server:latest`.
Change `image` in `compose.yaml` to use a different Docker Hub account or name.
You can also build with the desired name directly:

```sh
docker build -t joshdabomb/mathfinder-server:latest .
```

Once you are ready to publish the image:

```sh
docker login
docker push joshdabomb/mathfinder-server:latest
```

After publication, someone with Docker installed can run:

```sh
docker run -d --name mathfinder -p 127.0.0.1:5173:5173 joshdabomb/mathfinder-server:latest
```

They can open http://localhost:5173 and later use `docker stop mathfinder`
and `docker start mathfinder`. The image name is separate from the container
name (`mathfinder` in this command).

If port 5173 is already occupied, use `-p 127.0.0.1:5174:5173` and open
http://localhost:5174 instead.

## Local data and shared campaigns

By default the image runs in local-only mode. Character data is stored in the
browser's local storage, so use the same browser and address to keep accessing
it. Clearing browser site data removes local records.

Cloud accounts and shared campaigns require a reachable Supabase backend.
To enable them, pass its public frontend configuration when building:

```sh
docker build --build-arg VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY -t joshdabomb/mathfinder-server:latest .
```

These values are included in the browser bundle; use only the publishable key,
never a service-role key. Container environment variables do not reconfigure
an already-built Vite bundle. Local `.env` files and Supabase temporary files
are excluded from the Docker build.

An image built normally targets the builder's platform. For recipients on
both Intel/AMD and ARM machines, publish a multi-platform image:

```sh
docker buildx build --platform linux/amd64,linux/arm64 -t joshdabomb/mathfinder-server:latest --push .
```
