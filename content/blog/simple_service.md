+++
title = "Building a Custom NixOS Service with Flakes and Overlays"
date = 2025-05-09
+++

**TOC**

# Building a Custom NixOS Service with Flakes and Overlays

<!--toc:start-->
- [Building a Custom NixOS Service with Flakes and Overlays](#building-a-custom-nixos-service-with-flakes-and-overlays)
  - [Create Project Directory](#create-project-directory)
  - [Create `flake.nix`](#create-flakenix)
  - [Create `nixos-module.nix`](#create-nixos-modulenix)
  - [Add `nixosConfigurations` Output](#add-nixosconfigurations-output)
    - [Build the System Configuration](#build-the-system-configuration)
<!--toc:end-->


TL;DR NixOS's declarative configuration and flakes make it easy to create
custom services. This post shows how to build a minimal service using flakes
and overlays for a "meow" command

- This will be a complete minimal configuration for testing purposes.

## Create Project Directory

Start by creating a directory to hold your project, I called mine `meow`:

```bash
mkdir meow && cd meow
```

## Create `flake.nix`

Create a `flake.nix` with the following:

```nix
# flake.nix
{
  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs, ... }: {
    overlays.default = final: prev: {
      meow = final.writeShellScriptBin "meow" ''
        echo meow
      '';
    };

    nixosModules.default = { pkgs, config, lib, ... }: {
      imports = [ ./nixos-module.nix ];
      # inject dependencies from flake.nix, and don't do anything else
      config = lib.mkIf config.services.meow.enable {
        nixpkgs.overlays = [ self.overlays.default ];
        services.meow.package = lib.mkDefault pkgs.meow;
      };
    };

  };
}
```

## Create `nixos-module.nix`

Next we'll create the `nixos-module.nix` in the same directory with the
following content:

```nix
# nixos-module.nix
{ pkgs, config, lib, ... }:
let cfg = config.services.meow; in {
  options = {
    services.meow = {
      enable = lib.mkEnableOption "meow";
      package = lib.mkOption {
        description = "meow package to use";
        type = lib.types.package;
      };
    };
  };
  config = lib.mkIf cfg.enable {
    systemd.services.meow = {
      description = "meow at the user on the console";
      serviceConfig = {
        Type = "oneshot";
        ExecStart = "${cfg.package}/bin/meow";
        StandardOutput = "journal+console";
      };
      wantedBy = [ "multi-user.target" ];
    };
  };
}
```

## Add `nixosConfigurations` Output

Lastly, we will add a `nixosConfigurations` output to the `flake.nix`

```nix
# flake.nix
nixosConfigurations.test = nixpkgs.lib.nixosSystem {
  system = "x86_64-linux";
  modules = [
    self.nixosModules.default
    ({ pkgs, lib, ... }: {
      fileSystems."/" = {
        device = "/dev/sda1";
      };
      boot.loader.grub.enable = false;
      boot.initrd.enable = false;
      boot.kernel.enable = false;
      documentation.enable = false;

      services.meow.enable = true;

      system.stateVersion = "25.05";
    })
  ];
};
```

- `nixosConfigurations.test` is simply the name we chose for this particular
  NixOS system configuration.

The final product will look like this:

```nix
# flake.nix
{
  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

  outputs = {
    self,
    nixpkgs,
    ...
  }: {
    overlays.default = final: prev: {
      meow = final.writeShellScriptBin "meow" ''
        echo meow
      '';
    };

    nixosModules.default = {
      pkgs,
      config,
      lib,
      ...
    }: {
      imports = [./nixos-module.nix];
      # inject dependencies from flake.nix, and don't do anything else
      config = lib.mkIf config.services.meow.enable {
        nixpkgs.overlays = [self.overlays.default];
        services.meow.package = lib.mkDefault pkgs.meow;
      };
    };

    nixosConfigurations.test = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        self.nixosModules.default
        ({
          pkgs,
          lib,
          ...
        }: {
          fileSystems."/" = {
            device = "/dev/sda1";
          };
          boot.loader.grub.enable = false;
          boot.initrd.enable = false;
          boot.kernel.enable = false;
          documentation.enable = false;

          services.meow.enable = true;

          system.stateVersion = "25.05";
        })
      ];
    };
  };
}
```

### Build the System Configuration

Then build the system configuration:

`nix build .#nixosConfigurations.test.config.system.build.toplevel`

- If this builds successfully you'll see a `result` directory within your `meow`
  directory.

- I wouldn't recommend actually switching to this configuration but you could
  build it to gain familiarity with it. If you were to switch to it you would
  run `./result/bin/switch-to-configuration`

- Test in a NixOS Virtual Machine (Recommended):The safest way to see the "meow"
  output is to build the configuration and then run it in a NixOS virtual
  machine. You can do this using tools like `nixos-generate-config` and a
  virtualization tool (like VirtualBox, QEMU, or GNOME Boxes).
