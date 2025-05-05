+++
title = "Comparing Nix Flakes to Traditional Nix"
date = 2025-05-05
+++

## Comparing Flakes to Traditional Nix

### Flakes

TL;DR These are notes following the Nix-Hour #4, if you would rather just watch a YouTube video I share it at the end. This doesn't follow exactly but I put it together in a way I found easier to follow, it's long but has a lot of great insights for learning more about how NixOS works. It mainly compares how to get pure build results from both Traditional Nix and Flakes.

One of the primary benefits of Nix Flakes is their **default enforcement of pure evaluation**, leading to more reproducible and predictable builds. In Nix, an **impure operation or value depends on something outside of the explicit inputs** provided to the build process. This could include things like the user's system configuration, environment variables, or the current time. Impurity can lead to builds that produce different results on different systems or at different times, undermining reproducibility.

In this section, we will compare how Flakes and traditional Nix handle purity and demonstrate the steps involved in building a simple `hello` package using both methods.

We'll start by creating a `hello` directory:

```bash
mkdir hello && cd hello/
```

now create a `flake.nix`:

```nix flake.nix
{
  outputs = { self, nixpkgs }: {
    myHello = (import nixpkgs {}).hello;
  };
}
```

- Version control is recommended and required for certain sections of this. In the video he does all of this in the same directory which I think complicates things so I recommend using separate directories.

- In flakes there is no access to `builtins.currentSystem` so you have to implicitly add it. Commands like this and `builtins.getEnv "USER` are impure because they depend on the current system which can be different from user to user.

- Flakes enable pure evaluation mode by default, so with our flake as is running:

`nix build .#myHello` will fail.

To get around this you can pass:

```bash
 nix build .#myHello --impure
```

Let's explore some ways to make this flake build purely.

To do this we need to add the system attribute (i.e. `x86_64-linux`) with your current system, `flake-utils` simplifies making flakes system agnostic:

```nix flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        packages.myHello = pkgs.hello;
      }
    );
}
```

This will allow it to successfully build with `nix build .#myHello` because flake-utils provides the system attribute.

### Traditional Nix

Create another directory named `hello2` and a `default.nix` with the following contents:

```nix default.nix
{ myHello = (import <nixpkgs> { }).hello; }
```

Build it with:

```bash
nix-build -A myHello
```

We can see that it's impure with the nix repl:

```bash
nix repl
nix-repl> <nixpkgs>
/nix/var/nix/profiles/per-user/root/channels/nixos
```

- The output is the path to the nixpkgs channel and impure because it can be different between users, it depends on the environment

- Even if you have channels disabled like I do because I use flakes you get an output like this: `/nix/store/n5xdr9b74ni7iiqgbcv636a6d4ywfhbn-source`. This is still impure because it still represents a dependency on something external to your current Nix expression. It relies on a specific version of Nixpkgs being present in the store, if it's not available it will fail.

- GitHub's Role in Reproducibility: GitHub, and similar Git hosting platforms, provide a valuable feature: the ability to download archives (tar.gz or zip files) of a repository at a specific commit hash. This is incredibly important for reproducibility in Nix. By fetching Nixpkgs (or any other Git-based Nix dependency) as a tarball from a specific commit, you ensure that you are using a precise and immutable snapshot of the code. This eliminates the uncertainty associated with channels that can be updated.

We want to use the same revision for traditional nix for `nixpkgs` as we did for our nix flake. To do so you can get the revision # from the `flake.lock` file in our `hello` directory. You could cd to the hello directory and run `cat flake.lock` and look for:

```nix flake.lock
    "nixpkgs": {
      "locked": {
        "lastModified": 1746372124,
        "narHash": "sha256-n7W8Y6bL7mgHYW1vkXKi9zi/sV4UZqcBovICQu0rdNU=",
        "owner": "NixOS",
        "repo": "nixpkgs",
        "rev": "f5cbfa4dbbe026c155cf5a9204f3e9121d3a5fe0",
        "type": "github"
      },

```

- You have to add the revision number and add `.tar.gz` to the end of it. Also remove the `<>` around `nixpkgs` like so removing the impurity of using a registry lookup path so back in the `hello2` directory in the `default.nix`:

```nix default.nix
let
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/f5cbfa4dbbe026c155cf5a9204f3e9121d3a5fe0.tar.gz";
  };
in {
  myHello = (import nixpkgs {}).hello;
}
```

- And finally, we don't know the correct sha256 yet so we use a placeholder like so:

```nix default.nix
let
  nixpkgs = fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/0243fb86a6f43e506b24b4c0533bd0b0de211c19.tar.gz";
    sha256 = "0000000000000000000000000000000000000000000000000000";
  };
in { myHello = (import nixpkgs { }).hello; }
```

- You enter a placeholder for the sha256, after you run:
  `nix-build -A myHello` Nix will give you the correct hash to replace the zeros.

You can see that they produce the same result by running:

- In the `hello` directory with the `flake.nix` run `ls -al` and looking at the `result` symlink path.

- Now in the `hello2` directory with the `default.nix` run `nix-build -A myHello` the result will be the same path as the symlink above.

- In `default.nix` there is still an impurity, the "system" and actually more.

- Nixpkgs has 3 default arguments that people care about, i.e. when using `(import <nixpkgs> {})`:

  - `overlays`, by default ~/.config/nixpkgs/overlays. The existance and contents of this directory are dependent on the individual user's system configuration. Different users may have different overlays defined, or none at all. This means that the effective set of packages available when you import `<nixpkgs>` can vary from one user to another, making builds non-reproducible.

  - `config`, by default ~/.config/nixpkgs/config.nix. This allows users to set various Nixpkgs options like enabling or disabling features.

  - `system`, by default builtins.currentSystem. This is impure because the same Nix expression built on different machines (with different operating systems or architectures) will use a different system value, potentially leading to different build outputs or even build failures.

And they all have defaults that are impure.

Users have problems because they don't realize that defaults are pulled in and they have some overlays and config.nix that are custom to their setup. This can't happen in flakes because they enforces this. We can override this by passing empty lists and attribute sets and a system argument to the top-level function with a default like so:

```nix default.nix
{system ? builtins.currentSystem}:
let
  nixpkgs = fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/0243fb86a6f43e506b24b4c0533bd0b0de211c19.tar.gz";
    sha256 = "1qvdbvdza7hsqhra0yg7xs252pr1q70nyrsdj6570qv66vq0fjnh";
  };
in { myHello = (import nixpkgs {
    overlays = [];
    config = {};
    inherit system;
  }).hello;
}
```

- We want to be able to change the system even if we're on a different one, what typically is done is having a system argument to the top-level function like above.

- The main expression is pure now but the top-level function is still impure, but we can override it with the following:

if you import this file from somewhere else:

`import ./default.nix { system = "x86_64-linux"; }`

or from the cli:

```bash
nix-build -A myHello --argstr system x86_64-linux
```

or if you already have the path in your store you can try to build it with:

```bash
nix-build -A myHello --argstr system x86_64-linux --check
```

- It's called `--check` because it builds it again and then checks if the results are in the same path.

- You can also use pure evaluation mode in the old nix commands:

Get the rev from `git log`:

```bash
nix-instantiate --eval --pure-eval --expr 'fetchGit { url = ./.; rev = "b4fe677e255c6f89c9a6fdd3ddd9319b0982b1ad"; }'
```

Output: `{ lastModified = 1746377457; lastModifiedDate = "20250504165057"; narHash = "sha256-K6CRWIeVxTobxvGtfXl7jvLc4vcVVftOZVD0zBaz3i8="; outPath = "/nix/store/rqq60nk6zsp0rknnnagkr0q9xgns98m7-source"; rev = "b4fe677e255c6f89c9a6fdd3ddd9319b0982b1ad"; revCount = 1; shortRev = "b4fe677"; submodules = false; }`

- The `outPath` is how you evaluate derivations to path:

```nix
nix repl
nix-repl> :l <nixpkgs>
nix-repl> hello.outPath
"/nix/store/a7hnr9dcmx3qkkn8a20g7md1wya5zc9l-hello-2.12.1"
nix-repl> "${hello}"
"/nix/store/a7hnr9dcmx3qkkn8a20g7md1wya5zc9l-hello-2.12.1"
nix-repl> attrs = { outPath = "foo"; }
nix-repl> "${attrs}"
"foo"
```

- This shows how derivations get interpolated into strings.

- Now we can build the actual derivation with this, first run `git log` to get the commit hash:

```bash
❯: git log
commit b4fe677e255c6f89c9a6fdd3ddd9319b0982b1ad (HEAD -> main)
```

```bash
nix-build --pure-eval --expr '(import (fetchGit { url = ./.; rev = "b4fe677e255c6f89c9a6fdd3ddd9319b0982b1ad"; }) { system = "x86_64-linux"; }).myHello'
```

- As you can see this is very inconvenient, also every time you make a change you have to commit it again to get a new revision we also need to interpolate the string to get the revision into the string. Near the end I mention some tools that make working with traditional nix with pure evaluation easier.

### Back to Flakes

If we want to build the flake with a different Nixpkgs:

```bash
nix build .#myHello --override-input nixpkgs github:NixOS/nixpkgs/nixos-24.11
result/bin/hello --version
```

We can't really do this with our `default.nix` because it's hard-coded within a
let statement.

A common way around this is to write another argument which is `nixpkgs`:

```nix default.nix
{
  system ? builtins.currentSystem,
  nixpkgs ?
    fetchTarball {
      url = "https://github.com/NixOS/nixpkgs/archive/f5cbfa4dbbe026c155cf5a9204f3e9121d3a5fe0.tar.gz";
      sha256 = "1mbl5gnl40pjl80sfrhlbsqvyf7pl9r92vvdc43nivnblrivrdcz";
    },
  pkgs ?
    import nixpkgs {
      overlays = [];
      config = {};
      inherit system;
    },
}: {
  myHello = pkgs.hello;
}
```

Build it:

```bash
nix-build -A myHello
```

or

```bash
nix-build -A myHello --arg nixpkgs 'fetchTarball { url =
"https://github.com/NixOS/nixpkgs/archive/f5cbfa4dbbe026c155cf5a9204f3e9121d3a5fe0.tar.gz"; }'`
```

- `arg` provides a nix value as an argument, `argstr` turns a given string into a nix argument. Here we're not using pure evaluation mode for a temp override.

Or another impure command that you can add purity aspects to, Traditional Nix
has a lot of impurities by default but in almost all cases you can make it pure:

```bash
nix-build -A myHello --arg channel nixos-24.11
```

### Update the Nixpkgs version in flakes

```bash
nix flake update
warning: Git tree '/home/jr/nix-hour/flakes' is dirty
warning: updating lock file '/home/jr/nix-hour/flakes/flake.lock':
• Updated input 'nixpkgs':
    'github:NixOS/nixpkgs/0243fb86a6f43e506b24b4c0533bd0b0de211c19?narHash=sha256-0EoH8DZmY3CKkU1nb8HBIV9RhO7neaAyxBoe9dtebeM%3D' (2025-01-17)
  → 'github:NixOS/nixpkgs/0458e6a9769b1b98154b871314e819033a3f6bc0?narHash=sha256-xj85LfRpLO9E39nQSoBeC03t87AKhJIB%2BWT/Rwp5TfE%3D' (2025-01-18)
```

```bash
nix build .#myHello
```

Doing this with Traditional Nix is pretty easy with `niv`:

```bash
nix-shell -p niv
niv init
```

- This creates a `nix/` directory with a `sources.json` (lockfile) & `sources.nix` (a big file managed by `niv` to do the import correctly).

In our `default.nix`:

```nix default.nix
{ system ? builtins.currentSystem,
sources ? import nix/sources.nix,
nixpkgs ? sources.nixpkgs,
pkgs ? import nixpkgs {
  overlays = [ ];
  config = { };
  inherit system;
}, }: {
  myHello = pkgs.hello;
}
```

Build it:

```bash
nix-build -A myHello
```

`niv` can do much more, you can add a dependency with github owner and repo:

```bash
niv add TSawyer87/system
niv drop system
```

- use `niv drop` to remove dependencies.

- Update nixpkgs:

```bash
niv update nixpkgs --branch=nixos-unstable
nix-build -A myHello
```

The flake and default.nix are both using the same store object:

```bash
❯ nix-build -A myHello
unpacking 'https://github.com/NixOS/nixpkgs/archive/5df43628fdf08d642be8ba5b3625a6c70731c19c.tar.gz' into the Git cache...
/nix/store/a7hnr9dcmx3qkkn8a20g7md1wya5zc9l-hello-2.12.1
❯ ls -al
drwxr-xr-x    - jr 18 Jan 10:01  .git
drwxr-xr-x    - jr 18 Jan 10:01  nix
lrwxrwxrwx    - jr 18 Jan 10:17  result -> /nix/store/a7hnr9dcmx3qkkn8a20g7md1wya5zc9l-hello-2.12.1
```

- `niv` only relies on stable NixOS features, can be used for automatic source
  updates. They do the source tracking recursively,

### Adding Home-Manager

**Flakes:**

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    home-manager.url = "github:nix-community/home-manager";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in { packages.myHello = pkgs.hello; });
}
```

```bash
nix flake update
nix flake show github:nix-community/home-manager
```

- Flakes have a standard structure that Traditional Nix never had, the flake
  provides a default package, nixosModules, packages for different architectures,and templates. Pretty convenient.

- If you look at your `flake.lock` you'll see that home-manager was added as
  well as another `nixpkgs`.

**Traditional Nix:**

```bash
niv add nix-community/home-manager
```

```nix
nix repl
nix-repl> s = import ./nix/sources.nix
nix-repl> s.home-manager
```

We can follow the outPath and see that there's a `default.nix`, `flake.nix`,
`flake.lock` and much more. In the `default.nix` you'll see a section for `docs`.

- Home-manager has a `.outPath` that it uses by default which is a function,
  and Nix uses the `default.nix` by default.

If we want to build the docs go back to our `default.nix`:

```nix
{ system ? builtins.currentSystem, sources ? import nix/sources.nix
, nixpkgs ? sources.nixpkgs, pkgs ? import nixpkgs {
  overlays = [ ];
  config = { };
  inherit system;
}, }: {
  homeManagerDocs = (import sources.home-manager { pkgs = pkgs; }).docs;

  myHello = pkgs.hello;
}
```

Build it:

```bash
nix-build -A homeManagerDocs
```

With the `flake.nix` to do this you would add:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    home-manager.url = "github:nix-community/home-manager";
  };

  outputs = { self, nixpkgs, flake-utils, home-manager, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        packages.myHello = pkgs.hello;
        packages.x86_64-linux.homeManagerDocs =
          home-manager.packages.x86_64-linux.docs-html;
      });
}
```

Build it:

```bash
nix build .#myHello
```

- To have home-manager use the same Nixpkgs as your flake inputs you can add
  this under the home-manager input:

`home-manager.inputs.nixpkgs.follows = "nixpkgs";`

- I put this together from a [nix-hour comparing flakes to traditional Nix](https://www.youtube.com/watch?v=atmoYyBAhF4).
