+++
title = "Using Overlays to add Packages that aren't in Nixpkgs"
date = 2025-05-08
+++

## Using Overlays to add Packages that aren't in Nixpkgs

It is very common to use overlays in Nix to install packages that aren't available in the standard Nixpkgs repository.

- Overlays are one of the primary and recommended ways to extend and customize your Nix environment. It's important to remember that Nix overlays are made to allow you to modify or extend the package set provided by Nixpkgs (or other Nix sources) without directly altering the original package definitions. This is crucial for maintaining reproducibility and avoiding conflicts. Overlays are essentially functions that take the previous package set and allow you to add, modify, or remove packages.

- It may be helpful to first read my [Nix Flakes Tips&Tricks](https://saylesss88.github.io/blog/nix-flakes-tips-and-tricks/) post first to understand the outputs in my flake.

I'll show the process of adding the `pokego` package that is not in Nixpkgs:

1. In my `flake.nix` I have a custom inputs variable within my let block of my flake like so just showing the necessary parts for berevity:

```nix
# flake.nix
  outputs = my-inputs @ {
    self,
    nixpkgs,
    treefmt-nix,
    ...
  }: let
    system = "x86_64-linux";
    host = "magic";
    userVars = {
      username = "jr";
      gitUsername = "saylesss88";
      editor = "hx";
      term = "ghostty";
      keys = "us";
      browser = "firefox";
      flake = builtins.getEnv "HOME" + "/flake";
    };

    inputs =
      my-inputs
      // {
        pkgs = import inputs.nixpkgs {
          inherit system;
        };
        lib = {
          overlays = import ./lib/overlay.nix;
          nixOsModules = import ./nixos;
          homeModules = import ./home;
          inherit system;
        };
      };
      # ... snip ...

```

2. In the `overlay.nix` I have this helper function and the defined package:

```nix
# overlay.nix
_final: prev: let
  # Helper function to import a package
  callPackage = prev.lib.callPackageWith (prev // packages);

  # Define all packages
  packages = {
    # Additional packages
    pokego = callPackage ./pac_defs/pokego.nix {};
  };
in
  packages
```

1. `_final: prev:`: This is the function definition of the overlay.

- `_final`: This argument represents the final, merged package set after all overlays have been applied. It's often unused within a single overlay, hence the `_` prefix (a Nix convention for unused variables).

- `prev`: This is the crucial argument. It represents the package set before this overlay is applied. This allows you to refer to existing packages and functions from Nixpkgs.

2. `let ... in packages`: This introduces a `let` expression, which defines local variables within the scope of this overlay function. The `in packages` part means that the overlay function will ultimately return the `packages` attribute set defined within the `let` block.

3. `callPackage = prev.lib.callPackageWith (prev // packages)`: This line defines a helper function called `callPackage`.

- `prev.lib.callPackageWith` Is a function provided by Nixpkgs' `lib`. `callPackageWith` is like `prev.lib.callPackage`, but allows the passing of additional arguments that will then be passed to the package definition.

- `(prev // packages)`: This is an attribute set merge operation. It takes the `prev` package set (Nixpkgs before this overlay) and merges it with the `packages` attribute set defined later in this overlay.

- By using `callPackageWith` with this merged attribute set, the `callPackage` function defined here is set up to correctly import package definitions, ensuring they have access to both the original Nixpkgs and any other packages defined within this overlay.

4. `packages = { ... };`: This defines an attribute set named `packages`. This set will contain all the new or modified packages introduced by this overlay.

5. `pokego = callPackages ./pac_defs/pokego.nix { };`: This is the core of how the `pokego` package is added.

- `pokego =`: This defines a new attribute named `pokego` within the packages attribute set. This name will be used to refer to the pokego package later.

- `callPackage ./pac_defs/pokego.nix {}`: This calls the callPackage helper function defined earlier.

  - `./pac_defs/pokego.nix`: This is the path to another Nix file (pokego.nix) that contains the actual package definition for pokego. This file would define how to fetch, build, and install the pokego software (similar to the hello.nix example you saw earlier).
  - `{}`: This is an empty attribute set passed as additional arguments to the `pokego.nix` package definition. If `pokego.nix` expected any specific parameters (like versions or dependencies), you would provide them here. Since it's empty, it implies pokego.nix either has no required arguments or uses default values.

6. `in packages`: As mentioned earlier, the overlay function returns the packages attribute set. When this overlay is applied, the packages defined within this packages set (including pokego) will be added to the overall Nix package set.

### The pokego Package definition

The following is the `./pac_defs/pokego.nix`, it may be helpful to first read my [Package Definitions Explained](https://saylesss88.github.io/blog/package-definitions/) post to better understand the following:

```nix
# pokego.nix
{
  lib,
  buildGoModule,
  fetchFromGitHub,
}:
buildGoModule rec {
  pname = "pokego";
  version = "0.3.0";

  src = fetchFromGitHub {
    owner = "rubiin";
    repo = "pokego";
    rev = "v${version}";
    hash = "sha256-cFpEi8wBdCzAl9dputoCwy8LeGyK3UF2vyylft7/1wY=";
  };

  vendorHash = "sha256-7SoKHH+tDJKhUQDoVwAzVZXoPuKNJEHDEyQ77BPEDQ0=";

  # Install shell completions
  postInstall = ''
    install -Dm644 completions/pokego.bash "$out/share/bash-completion/completions/pokego"
    install -Dm644 completions/pokego.fish "$out/share/fish/vendor_completions.d/pokego.fish"
    install -Dm644 completions/pokego.zsh "$out/share/zsh/site-functions/_pokego"
  '';

  meta = with lib; {
    description = "Command-line tool that lets you display Pokémon sprites in color directly in your terminal";
    homepage = "https://github.com/rubiin/pokego";
    license = licenses.gpl3Only;
    maintainers = with maintainers; [
      rubiin
      jameskim0987
      vinibispo
    ];
    mainProgram = "pokego";
    platforms = platforms.all;
  };
}
```

#### Adding the overlay to your configuration

There are a few places you could choose to put the following, I choose to use my `configuration.nix` because of my setup:

```nix
# configuration.nix
nixpkgs.overlays = [inputs.lib.overlays]
```

## Installing Pokego

- If you are managing your entire system configuration with NixOS, you would typically add `pokego` to your `environment.systemPackages`.

```nix
# configuration.nix
environment.systemPackages = with pkgs; [
  pokego
]
```

- If you prefer home-manager you can install `pokego` with home-manager also:

```nix
# home.nix
home.packages = [
  pkgs.pokego
]
```
