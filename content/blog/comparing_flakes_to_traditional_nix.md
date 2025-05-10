+++
title = "Nix Flakes vs. Traditional Nix: A Comparison"
date = 2025-05-05
+++

**TOC**

<!--toc:start-->

- [Introduction: Flakes and Traditional Nix](#introduction-flakes-and-traditional-nix)

  - [What is Purity in Nix?](#what-is-purity-in-nix)
  - [Building a Simple "hello" Package: Flakes vs. Traditional Nix](#building-a-simple-hello-package-flakes-vs-traditional-nix) - [Using Nix Flakes](#using-nix-flakes) - [Using Traditional Nix](#using-traditional-nix) - [Updating Nixpkgs](#updating-nixpkgs) - [Updating Traditional Nix (using `niv`)](#updating-traditional-nix-using-niv) - [Adding Home-Manager with Flakes](#adding-home-manager-with-flakes) - [Adding Home-Manager with Traditional Nix](#adding-home-manager-with-traditional-nix)
  <!--toc:end-->

# Introduction: Flakes and Traditional Nix

- This post is based on notes from Nix-Hour #4, comparing Traditional Nix and Flakes, focusing on achieving pure build results. See the [YouTube video](https://www.youtube.com/watch?v=atmoYyBAhF4) for the original content. This guide adapts the information for clarity and ease of understanding.

## What is Purity in Nix?

- A key benefit of Nix Flakes is their _default_ enforcement of **pure evaluation**.

- In Nix, an **impure operation** depends on something _outside_ its explicit inputs. Examples include:

  - User's system configuration
  - Environment variables
  - Current time

- Impurity leads to unpredictable builds that may differ across systems or time.

## Building a Simple "hello" Package: Flakes vs. Traditional Nix

- We'll demonstrate building a basic "hello" package using both Flakes and Traditional Nix to highlight the differences in handling purity.

### Using Nix Flakes

1.  **Setup:**

    ```bash
    mkdir hello && cd hello/
    ```

2.  **Create `flake.nix` (Initial Impure Example):**

    ```nix
    # flake.nix
    {
      outputs = { self, nixpkgs }: {
        myHello = (import nixpkgs {}).hello;
      };
    }
    ```

    - Note: Flakes don't have access to `builtins.currentSystem` directly.

3.  **Impure Build (Fails):**

    ```bash
    nix build .#myHello
    ```

    - This fails because Flakes enforce purity by default.

4.  **Force Impure Build:**

    ```bash
    nix build .#myHello --impure
    ```

5.  **Making the Flake Pure:**

    ```nix
    # flake.nix
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

    - `flake-utils` simplifies making flakes system-agnostic and provides the `system` attribute.

6.  **Pure Build (Success):**
    ```bash
    nix build .#myHello
    ```

### Using Traditional Nix

1.  **Setup:**

    ```bash
    mkdir hello2 && cd hello2/
    ```

2.  **Create `default.nix` (Initial Impure Example):**

    ```nix
    # default.nix
    { myHello = (import <nixpkgs> { }).hello; }
    ```

3.  **Build (Impure):**

    ```bash
    nix-build -A myHello
    ```

4.  **Impurity Explained:**

    ```bash
    nix repl
    nix-repl> <nixpkgs>
    /nix/var/nix/profiles/per-user/root/channels/nixos
    ```

    - `<nixpkgs>` depends on the user's environment (Nixpkgs channel), making it impure. Even with channels disabled, it relies on a specific Nixpkgs version in the store.

5.  **Achieving Purity: Using `fetchTarball`**

    - GitHub allows downloading repository snapshots at specific commits, crucial for reproducibility.

    - **Get Nixpkgs Revision from `flake.lock` (from the Flake example):**

    ```nix
    # flake.lock
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

6.  **Modify `default.nix` for Purity:**

    ```nix
    # default.nix
    let
      nixpkgs = fetchTarball {
        url = "[https://github.com/NixOS/nixpkgs/archive/f5cbfa4dbbe026c155cf5a9204f3e9121d3a5fe0.tar.gz](https://github.com/NixOS/nixpkgs/archive/f5cbfa4dbbe026c155cf5a9204f3e9121d3a5fe0.tar.gz)";
        sha256 = "0000000000000000000000000000000000000000000000000000"; # Placeholder
      };
    in {
      myHello = (import nixpkgs {}).hello;
    }
    ```

    - Replace `<nixpkgs>` with `fetchTarball` and a specific revision. A placeholder `sha256` is used initially.

7.  **Build (Nix provides the correct `sha256`):**

    ```bash
    nix-build -A myHello
    ```

8.  **Verification:** Both Flake and Traditional Nix builds now produce the same output path.

9.  **Remaining Impurities in Traditional Nix:**

    - Default arguments to `import <nixpkgs> {}` can introduce impurity:
      - `overlays`: `~/.config/nixpkgs/overlays` (user-specific)
      - `config`: `~/.config/nixpkgs/config.nix` (user-specific)
      - `system`: `builtins.currentSystem` (machine-specific)

10. **Making Traditional Nix Fully Pure:**

    ```nix
    # default.nix
    {system ? builtins.currentSystem}:
    let
      nixpkgs = fetchTarball {
        url =
          "[https://github.com/NixOS/nixpkgs/archive/0243fb86a6f43e506b24b4c0533bd0b0de211c19.tar.gz](https://github.com/NixOS/nixpkgs/archive/0243fb86a6f43e506b24b4c0533bd0b0de211c19.tar.gz)";
        sha256 = "1qvdbvdza7hsqhra0yg7xs252pr1q70nyrsdj6570qv66vq0fjnh";
      };
    in {
      myHello = (import nixpkgs {
        overlays = [];
        config = {};
        inherit system;
      }).hello;
    }
    ```

    - Override impure defaults for `overlays`, `config`, and make `system` an argument.

11. **Building with a Specific System:**

    ```bash
    nix-build -A myHello --argstr system x86_64-linux
    ```

12. **Pure Evaluation Mode in Traditional Nix:**

    ```bash
    nix-instantiate --eval --pure-eval --expr 'fetchGit { url = ./.; rev = "b4fe677e255c6f89c9a6fdd3ddd9319b0982b1ad"; }'
    ```

    - Example of using `--pure-eval`.

    ```bash
    nix-build --pure-eval --expr '(import (fetchGit { url = ./.; rev = "b4fe677e255c6f89c9a6fdd3ddd9319b0982b1ad"; }) { system = "x86_64-linux"; }).myHello'
    ```

    - Building with a specific revision and system.

### Updating Nixpkgs

```bash
nix flake update
```

```nix
nix build .#myHello --override-input nixpkgs github:NixOS/nixpkgs/nixos-24.11
```

### Updating Traditional Nix (using `niv`)

```nix
nix-shell -p niv
niv init
```

```nix
# default.nix
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

And build it with:

```bash
nix-build -A myHello
```

```bash
niv update nixpkgs --branch=nixos-unstable
nix-build -A myHello
```

#### Adding Home-Manager with Flakes

```nix
# flake.nix
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

```bash
nix flake update
nix flake show github:nix-community/home-manager
```

```nix
home-manager.inputs.follows = "nixpkgs";
```

#### Adding Home-Manager with Traditional Nix

```nix
niv add nix-community/home-manager
```

```nix
nix repl
nix-repl> s = import ./nix/sources.nix
nix-repl> s.home-manager
```

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

```bash
nix-build -A homeManagerDocs
```
