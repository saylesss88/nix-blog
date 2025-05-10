+++
title = "Building your Configuration as a Package"
date = 2025-05-05
+++

**TOC**

# Building your configuration as a Package

<!--toc:start-->

- [Building your configuration as a Package](#building-your-configuration-as-a-package)

  - [Benefits of `nixosConfiguration` as a Package](#benefits-of-nixosconfiguration-as-a-package)

  - [Usage and Deployment](#usage-and-deployment)

  - [Adding a Configuration VM Output](#adding-a-configuration-vm-output) - [Debugging](#debugging) - [Understanding Atomicity:](#understanding-atomicity)
  <!--toc:end-->

- TL;DR This post demonstrates other ways to modularize your config as well as
  going into more advanced outputs.

- This allows you to build your configuration as a package allowing you to
  separate the process of creating a configuration artifact and applying it to
  the live system giving you a reusable artifact that can be used to deploy to
  different systems. This can make it easier to isolate it from other parts of
  your system making debugging easier.

The following is a snip of my `flake.nix`:

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
      gitUsername = "TSawyer87";
      editor = "hx";
      term = "ghostty";
      keys = "us";
      browser = "firefox";
      flake = builtins.getEnv "HOME" + "/my-nixos";
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

    defaultConfig = import ./hosts/magic {
      inherit inputs;
    };

    in {
      packages.${system} = {
        nixos = defaultConfig.config.system.build.toplevel;
      };
          # NixOS configuration
    nixosConfigurations.${host} = lib.nixosSystem {
      inherit system;
      specialArgs = {
        inherit inputs system host userVars;
      };
      modules = [
        ./hosts/${host}/configuration.nix
      ];
    };
  };
    }
```

- I didn't want to change the name of `inputs` and effect other areas of my
  config so I first renamed `@ inputs` to `@ my-inputs` to make the merged
  attribute set use the original `inputs` name.

- Note, I'm still using home-manager as a module I just had to move it for all
  modules to be available inside the artifact built with `nix build .#nixos`

## Benefits of `nixosConfiguration` as a Package

`packages.x86_64-linux.nixos = self.nixosConfigurations.magic.config.system.build.toplevel;`

- The above expression exposes the `toplevel` derivation of
  `nixosConfiguration.magic` as a package, which is the complete system closure
  of your NixOS configuration.

Here is the `/hosts/magic/default.nix`:

```nix
# default.nix
{inputs, ...}:
inputs.nixpkgs.lib.nixosSystem {
  inherit (inputs.lib) system;
  specialArgs = {inherit inputs;};
  modules = [./configuration.nix];
}
```

- Because we want all modules, not just NixOS modules this requires changing
  your `configuration.nix` to include your home-manager configuration. The core
  reason for this is that the `packages.nixos` output builds a NixOS system, and
  home-manager needs to be a part of that system's definition to be included in
  the build.

```nix
# configuration.nix
{
  pkgs,
  inputs,
  host,
  system,
  userVars,
  ...
}: {
  imports = [
    ./hardware.nix
    ./security.nix
    ./users.nix
    inputs.lib.nixOsModules
    # inputs.nixos-hardware.nixosModules.common-gpu-amd
    inputs.nixos-hardware.nixosModules.common-cpu-amd
    inputs.stylix.nixosModules.stylix
    inputs.home-manager.nixosModules.home-manager
  ];

  # Home-Manager Configuration needs to be here for home.packages to be available in the Configuration Package and VM i.e. `nix build .#nixos`
  home-manager = {
    useGlobalPkgs = true;
    useUserPackages = true;
    extraSpecialArgs = {inherit pkgs inputs host system userVars;};
    users.jr = {...}: {
      imports = [
        inputs.lib.homeModules
        ./home.nix
      ];
    };
  };
  ############################################################################

  nixpkgs.overlays = [inputs.lib.overlays];
```

> [!NOTE]: `inputs.lib.nixOsModules` is equivalent to `../../home` in my case
> and imports all of my nixOS modules. This comes from the `flake.nix` where I
> have `nixOsModules = import ./nixos` Which looks for a `default.nix` in the
> `nixos` directory.

My `~/my-nixos/nixos/default.nix` looks like this:

```nix
# default.nix
{...}: {
  imports = [
    ./drivers
    ./boot.nix
    ./utils.nix
    #..snip..
  ];
}
```

## Usage and Deployment

To build the package configuration run:

```nix
nix build .#nixos
sudo ./result/bin/switch-to-configuration switch
```

## Adding a Configuration VM Output

Building on what we already have, add this under `defaultConfig`:

```nix
    defaultConfig = import ./hosts/magic {
      inherit inputs;
    };

    vmConfig = import ./lib/vms/nixos-vm.nix {
      nixosConfiguration = defaultConfig;
      inherit inputs;
    };
```

and under the line `nixos = defaultConfig.config.system.build.toplevel` add:

```nix
packages.${system} = {
      # build and deploy with `nix build .#nixos`
    nixos = defaultConfig.config.system.build.toplevel;
    # Explicitly named Vm Configuration `nix build .#nixos-vm`
    nixos-vm = vmConfig.config.system.build.vm;
}
```

And in `lib/vms/nixos-vm.nix`:

```nix
# nixos-vm.nix
{
  inputs,
  nixosConfiguration,
  ...
}:
nixosConfiguration.extendModules {
  modules = [
    (
      {pkgs, ...}: {
        virtualisation.vmVariant = {
          virtualisation.forwardPorts = [
            {
              from = "host";
              host.port = 2222;
              guest.port = 22;
            }
          ];
          imports = [
            inputs.nixos-hardware.nixosModules.common-gpu-amd
            # hydenix-inputs.nixos-hardware.nixosModules.common-cpu-intel
          ];
          virtualisation = {
            memorySize = 8192;
            cores = 6;
            diskSize = 20480;
            qemu = {
              options = [
                "-device virtio-vga-gl"
                "-display gtk,gl=on,grab-on-hover=on"
                "-usb -device usb-tablet"
                "-cpu host"
                "-enable-kvm"
                "-machine q35,accel=kvm"
                "-device intel-iommu"
                "-device ich9-intel-hda"
                "-device hda-output"
                "-vga none"
              ];
            };
          };
          #! you can set this to skip login for sddm
          # services.displayManager.autoLogin = {
          #   enable = true;
          #   user = "jr";
          # };
          services.xserver = {
            videoDrivers = [
              "virtio"
            ];
          };

          system.stateVersion = "24.11";
        };

        # Enable SSH server
        services.openssh = {
          enable = true;
          settings = {
            PermitRootLogin = "no";
            PasswordAuthentication = true;
          };
        };

        virtualisation.libvirtd.enable = true;
        environment.systemPackages = with pkgs; [
          open-vm-tools
          spice-gtk
          spice-vdagent
          spice
        ];
        services.qemuGuest.enable = true;
        services.spice-vdagentd = {
          enable = true;
        };
        hardware.graphics.enable = true;

        # Enable verbose logging for home-manager
        # home-manager.verbose = true;
      }
    )
  ];
}
```

- Uncomment and add your username to auto login.

And an `apps` output that will build and deploy in one step with
`nix build .#deploy-nixos` I'll show `packages` and `apps` outputs for
context:

```nix
   # flake.nix
    # Default package for tools
    packages.${system} = {
      default = pkgs.buildEnv {
        name = "default-tools";
        paths = with pkgs; [helix git ripgrep nh];
      };
      # build and deploy with `nix build .#nixos`
      nixos = defaultConfig.config.system.build.toplevel;
      # Explicitly named Vm Configuration `nix build .#nixos-vm`
      nixos-vm = vmConfig.config.system.build.vm;
    };

    apps.${system}.deploy-nixos = {
      type = "app";
      program = toString (pkgs.writeScript "deploy-nixos" ''
        #!/bin/sh
        nix build .#nixos
        sudo ./result/bin/switch-to-configuration switch
      '');
      meta = {
        description = "Build and deploy NixOS configuration using nix build";
        license = lib.licenses.mit;
        maintainers = [
          {
            name = userVars.gitUsername;
            email = userVars.gitEmail;
          }
        ];
      };
    };
```

### Debugging

- Before switching configurations, verify what's inside your built package:

```bash
nix build .#nixos --dry-run
nix build .#nixos-vm --dry-run
nix show-derivation .#nixos
```

- Explore the Package Contents

Once the build completes, you get a store path like
`/nix/store/...-nixos-system`. You can explore the contents using:

```bash
nix path-info -r .#nixos
tree ./result
ls -lh ./result/bin
```

Instead of switching, test components:

```bash
nix run .#nixos --help
nix run .#nixos --version
```

Load the flake into the repl:

```bash
nixos-rebuild repl --flake .
nix-repl> flake.inputs
nix-repl> config.fonts.packages
nix-repl> config.system.build.toplevel
nix-repl> config.services.smartd.enable # true/false
nix-repl> flake.nixosConfigurations.nixos # confirm the built package
nix-repl> flake.nixosConfigurations.magic # Inspect host-specific config
```

- You can make a change to your configuration while in the repl and reload with
  `:r`

### Understanding Atomicity:

- Atomicity means that a system update (e.g. changing `configuration.nix` or a
  flake-based `toplevel` package) either fully succeeds or leaves the system
  unchanged, preventing partial or inconsistent states.

- The `toplevel` package is the entry point for your entire NixOS system,
  including the kernel, initrd, system services, and `home-manager` settings.

- Building with `nix build .#nixos` creates the `toplevel` derivation upfront,
  allowing you to inspect or copy it before activation:

```nix
nix build .#nixos
ls -l result
```

- In contrast, `nixos-rebuild switch` builds and activates in one step, similar
  to `cargo run` although both do involve the same `toplevel` derivation.

The `toplevel` package can be copied to another NixOS machine:

```nix
nix build .#nixos
nix copy ./result --to ssh://jr@server
# or for the vm
nix build .#nixos-vm
nix copy .#nixos-vm --to ssh://jr@server
# activate the server
ssh jr@server
sudo /nix/store/...-nixos-system-magic/bin/switch-to-configuration switch
```

- I got the examples for building your configuration as a package and vm from
  the [hydenix](https://github.com/richen604/hydenix/tree/main?tab=readme-ov-file)
  configuration and adapted them to [my config](https://github.com/saylesss88/flake).

- I got the examples for building your configuration as a package and vm from
  the [hydenix](https://github.com/richen604/hydenix/tree/main?tab=readme-ov-file)
  configuration and adapted them to [my config](https://github.com/saylesss88/flake).
