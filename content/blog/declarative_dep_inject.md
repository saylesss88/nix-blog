+++
title = "Declarative Dependency Injection in Nix Flakes"
date = 2025-05-06
+++

**TOC**

# Declarative Dependency Injection in Nix Flakes

<!--toc:start-->

- [The Problem with `specialArgs`](#the-problem-with-specialargs)
- [A Declarative Solution: Injecting via a Custom Option](#a-declarative-solution-injecting-via-a-custom-option) - [Defining the `dep-inject` Module in `flake.nix`](#defining-the-dep-inject-module-in-flakenix) - [Benefits of this Approach](#benefits-of-this-approach) - [Example Usage](#example-usage) - [Applying `dep-inject` to Home Manager Modules](#applying-dep-inject-to-home-manager-modules) - [Conclusion](#conclusion)
<!--toc:end-->

This post explores a method for injecting dependencies into NixOS modules from
a flake in a more declarative way, offering an alternative to `specialArgs`.

## The Problem with `specialArgs`

- As mentioned in [post](https://saylesss88.github.io/blog/nix-flakes-tips-and-tricks/),
  `specialArgs` and `extraSpecialArgs` can be used to pass dependencies and
  variables from flakes to modules.

- However, `specialArgs` injects values directly into every module's argument
  list.

- This approach deviates from NixOS's typical declarative data flow model.
  Instead of explicit dependency passing, modules receive extra, unstructured
  variables that aren't part of the standard module options.

## A Declarative Solution: Injecting via a Custom Option

This post introduces a more declarative and centralized technique to share
dependencies across modules by defining a custom option within your `flake.nix`
. This method makes dependencies accessible to all importing modules without
relying on explicit `specialArgs` in your flake's `outputs`.

### Defining the `dep-inject` Module in `flake.nix`

Within the `outputs` function's `let` block in your `flake.nix`, define the
following module:

```nix
# flake.nix
let
  # Module to inject dependencies
  depInject = { pkgs, lib, ... }: {
    options.dep-inject = lib.mkOption {
      # dep-inject is an attribute set of unspecified values
      type = with lib.types; attrsOf unspecified;
      default = { };
    };
    config.dep-inject = {
      # 'inputs' comes from the outer environment of flake.nix
      # usually contains flake inputs, user-defined vars, system metadata
      "flake-inputs" = inputs;
      userVars = userVars;
      system = system;
      host = host;
      username = username;
    };
  };
in {
  nixosModules.default = { pkgs, lib, ... }: {
    imports = [ depInject ];
  };
}
```

- This code defines a reusable NixOS module (`nixosModules.default`).

- This module creates a `dep-inject` option, which is an attribute set
  containing your flake's inputs and other relevant variables.

- By importing depInject, configurations automatically gain access to these
  dependencies.

#### Benefits of this Approach

- **Declarative Dependency Flow**: Encourages a more declarative style by
  accessing dependencies through a well-defined option (`config.dep-inject`)
  rather than implicit arguments.

- **Centralized Dependency Management**: Defines dependencies in one place
  (`flake.nix`), making it easier to manage and update them.

- **Automatic Availability**: Modules importing the configuration automatically
  have access to the injected dependencies.

- **Reduced Boilerplate**: Avoids the need to explicitly include dependency
  arguments (`{ inputs, userVars, ... }`) in every module.

##### Example Usage

Here's a practical example of how this `dep-inject` module is defined and used
within a `flake.nix`:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager/master";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    stylix.url = "github:danth/stylix";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };

  outputs = { self, nixpkgs, home-manager, stylix, treefmt-nix, ... } @ inputs: let
    system = "x86_64-linux";
    host = "magic";
    username = "jr";
    userVars = {
      timezone = "America/New_York";
      gitUsername = "TSawyer87";
      locale = "en_US.UTF-8";
      dotfilesDir = "~/.dotfiles";
      wm = "hyprland";
      browser = "firefox";
      term = "ghostty";
      editor = "hx";
      keyboardLayout = "us";
    };
    pkgs = import nixpkgs {
      inherit system;
      config.allowUnfree = true;
    };
    treefmtEval = treefmt-nix.lib.evalModule pkgs ./treefmt.nix;

    # Define dep-inject module
    depInject = { pkgs, lib, ... }: {
      options.dep-inject = lib.mkOption {
        type = with lib.types; attrsOf unspecified;
        default = { };
      };
      config.dep-inject = {
        flake-inputs = inputs;
        userVars = userVars; # Add userVars for convenience
        system = system;
        username = username;
        host = host;
      };
    };
  in {
    # Export dep-inject module
    nixosModules.default = { pkgs, lib, ... }: {
          imports = [ depInject ];
    };
    # here we don't need imports = [ depInject { inherit inputs;}]
    # because the vars are captured from the surrounding let block

    # NixOS configuration
    nixosConfigurations = {
      ${host} = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          # enable dep-inject
          self.nixosModules.default
          ./hosts/${host}/configuration.nix
          home-manager.nixosModules.home-manager
          stylix.nixosModules.stylix
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users.${username} = import ./hosts/${host}/home.nix;
            home-manager.backupFileExtension = "backup";
            # Still need extraSpecialArgs for Home Manager (see below)
            home-manager.extraSpecialArgs = {
              inherit username system host userVars;
            };
          }
        ];
      };
    };

    # Other outputs
    checks.x86_64-linux.style = treefmtEval.config.build.check self;
    formatter.x86_64-linux = treefmtEval.config.build.wrapper;
    devShells.${system}.default = import ./lib/dev-shell.nix { inherit inputs; };
  };
}
```

**Using `dep-inject` in Modules**

Once the `dep-inject` module is imported, you can access the injected
dependencies within any module via `config.dep-inject`.

**Example: System Configuration Module (`configuration.nix`)**

```nix
# configuration.nix
{ config, pkgs, ... }: {
  environment.systemPackages = with config.dep-inject.flake-inputs.nixpkgs.legacyPackages.${pkgs.system}; [
    firefox
    config.dep-inject.userVars.editor # e.g., helix
  ];
  time.timeZone = config.dep-inject.userVars.timezone;
  system.stateVersion = "24.05";
}
```

- `config.dep-inject.flake-inputs.nixpkgs`: Accesses the `nixpkgs` input.

- `config.dep-inject.userVars`: Accesses your `userVars`.

- You no longer need to explicitly declare `{ inputs, userVars, ... }` in the
  module's arguments.

#### Applying `dep-inject` to Home Manager Modules

By default, the `dep-inject` module is available to NixOS modules but not
automatically to Home Manager modules. There are two main ways to make it
accessible:

1. Using `extraSpecialArgs` (Less Ideal)

```nix
home-manager.extraSpecialArgs = {
  inherit username system host userVars;
  depInject = config.dep-inject; # Pass dep-inject
};
```

Then, in your Home Manager configuration (`./hosts/${host}/home.nix`):

```nix
# home.nix
{ depInject, ... }: {
  programs.git = {
    enable = true;
    userName = depInject.userVars.gitUsername;
  };
  home.packages = with depInject.flake-inputs.nixpkgs.legacyPackages.x86_64-linux; [ firefox ];
}
```

2. Importing `depInject` into Home Manager Configuration (More Idiomatic)

```nix
# flake.nix
nixosConfigurations = {
  ${host} = nixpkgs.lib.nixosSystem {
    inherit system;
    modules = [
      self.nixosModules.default # dep-inject for NixOS
      ./hosts/${host}/configuration.nix
      home-manager.nixosModules.home-manager
      stylix.nixosModules.stylix
      {
        home-manager.useGlobalPkgs = true;
        home-manager.useUserPackages = true;
        home-manager.backupFileExtension = "backup";
        home-manager.users.${username} = {
          imports = [ self.nixosModules.default ]; # dep-inject for Home Manager
          # Your Home Manager config
          programs.git = {
            enable = true;
            userName = config.dep-inject.userVars.gitUsername;
          };
          # note: depending on your setup you may need to tweak this
          # `legacyPackages.${pkgs.system}` might be needed
          # due to how home-manager handles `pkgs`
          home.packages = with config.dep-inject.flake-inputs.nixpkgs.legacyPackages.x86_64-linux; [ firefox ];
        };
      }
    ];
  };
};
```

- By adding `imports = [ self.nixosModules.default ];` within the Home Manager
  user configuration, the `dep-inject` option becomes available under `config`.

- This approach is generally considered more idiomatic and avoids the issues
  associated with `specialArgs`, as highlighted in resources like
  "flakes-arent-real"

##### Conclusion

While `specialArgs` offers a seemingly straightforward way to inject
dependencies, this declarative approach using a custom `dep-inject` option
promotes a cleaner, more structured, and potentially more robust method for
managing dependencies across your NixOS modules. It aligns better with NixOS's
declarative principles and can enhance the maintainability and
understandability of your configuration.

**Disclaimer**

- I don't currently personally use this technique in my configuration, it adds
  complexity that `specialArgs` aimed to solve. However, presenting this
  alternative enhances understanding of different dependency injection methods
  in Nix Flakes. This example is inspired by and builds upon concepts discussed in
  [flakes-arent-real](https://jade.fyi/blog/flakes-arent-real/)
