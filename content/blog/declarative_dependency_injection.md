+++
title = "Declarative Dependency Injection"
date = 2025-05-06
+++

### Injecting Dependencies into Modules from a Flake

- In my last [post](https://saylesss88.github.io/blog/nix-flakes-tips-and-tricks/) I touched on `specialArgs` and `extraSpecialArgs` being ways to inject dependencies and variables from flakes to modules, this is another way to inject dependencies. `specialArgs` dumps values directly into every module's argument list, which breaks the usual declarative data flow model of NixOS. Instead of passing dependencies explicitly, your modules suddenly receive extra variables that aren't structured like normal module options.

  First we'll define a custom option in an inline module that has the needed dependencies in its lexical closure inside of `flake.nix` to inject said dependencies into our NixOS configuration. This makes those dependencies available to all modules that import this configuration, without needing to pass them explicitly via `specialArgs` in your flakes `outputs`. It's a more declarative and centralized way to share dependencies across modules.

This is defined within the `outputs` function's `let` block in your `flake.nix`:

```nix
# flake.nix
let
  # list deps you want passed here
  depInject = { pkgs, lib, ... }: {
    options.dep-inject = lib.mkOption {
      # dep-inject is an attr set of unspecified values
      type = with lib.types; attrsOf unspecified;
      default = { };
    };
    config.dep-inject = {
      # inputs comes from the outer environment of flake.nix
      # usually contains flake inputs, user-defined vars
      # sys metadata
      flake-inputs = inputs;
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

- This defines a reusable NixOS module (`nixosModules.default`) that creates a `dep-inject` option and sets it to include your flakes inputs. It automates the process of passing `inputs` to individual modules in your `nixosConfigurations`

- This allows you to access these dependencies directly from `config.dep-inject`, without the need to explicitly declare them in their argument list (e.g.
  `{ inputs, pkgs, lib, ... }`) and promotes a more declarative approach moving away from the imperative step of explicitly passing arguments everywhere.

- The `depInject` module becomes a reusable component that any NixOS configuration within your flake can import this module automatically and gain access to the injected dependencies.

Example use:

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

#### Use `dep-inject` in any Module

- In any module that's part of this configuration, you can access the injected dependencies via `config.dep-inject`. You don't need to add `inputs` or `userVars` to the module's arguments.

Example: System Configuration Module

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

- `config.dep-inject.flake-inputs.nixpkgs`: Accesses the `nixpkgs` input

- `config.dep-inject.userVars`: Access your `userVars`

- Unlike `specialArgs`, you don't need `{ inputs, userVars, ... }`

#### Use `dep-inject` in home-manager modules

- By default, `dep-inject` is available in NixOS modules but not automatically in home-manager modules unless you either:

  - Pass `dep-inject` via `extraSpecialArgs` (less ideal)
    or
  - Import the `depInject` module into home-managers configuration.

1. Using `extraSpecialArgs`

```nix
home-manager.extraSpecialArgs = {
  inherit username system host userVars;
  depInject = config.dep-inject; # Pass dep-inject
};
```

Then in `./hosts/${host}/home.nix`:

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

2. Import `depInject` into home-manager:

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

- `imports = [ self.nixosModules.default ]`: Makes `dep-inject` available in home-managers `config`.

- **Access**: Use `config.dep-inject` directly in home-manager modules, no `extraSpecialArgs` needed.

- This is considered more idiomatic and as mentioned in "flakes-arent-real" linked below, `specialArgs` is uglier, since it gets dumped into the arguments for every module, which is unlike how every other bit of data flow works in NixOS, and it also doesn't work outside of the flake that's actually invoking `nixpkgs.lib.nixosSystem`, if you try using modules outside of that particular Flake, the injected arguments won't persist.

- By explicitly handling dependency injection in a more declarative way (e.g. `config.dep-inject`), you ensure that dependencies remain accessible accross different modules, regardless of where they are used.

- I don't personally use this technique for injecting dependencies in my NixOS configuration. It adds complexity that I believe `specialArgs` was supposed to solve and on modern computers I don't think it will matter too much. This is just another way to do things and a way to enhance understanding.

- I got this example from [flakes-arent-real](https://jade.fyi/blog/flakes-arent-real/) and built on it to enhance understanding. If you have any tips or notice any inaccuracies please let me know.
