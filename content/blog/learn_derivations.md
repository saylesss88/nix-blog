+++
title = "Understanding Nix Derivations: A Beginner's Guide & Resources"
date = 2025-05-09
+++

# Introduction to Nix Derivations

- A derivation in Nix is a fundamental concept that describes how to build a piece of software or a resource (e.g., a package, library, or configuration file). Think of it as a recipe for creating something within the Nix ecosystem.

- For beginners, the analogy of a cooking recipe is helpful:

  - **Ingredients (Dependencies):** What other software or libraries are needed.
  - **Steps (Build Instructions):** The commands to compile, configure, and install.
  - **Final Dish (Output):** The resulting package or resource.

- A Nix derivation encapsulates all this information, telling Nix what inputs to use, how to build it, and what the final output should be.

## Creating Derivations in Nix

- The primary way to define packages in Nix is through the `mkDerivation` function, which is part of the standard environment (`stdenv`). While a lower-level `derivation` function exists for advanced use cases, `mkDerivation` simplifies the process by automatically managing dependencies and the build environment.

- `mkDerivation` (and `derivation`) takes a set of attributes as its argument. At a minimum, you'll often encounter these essential attributes:

  1.  **name:** A human-readable identifier for the derivation (e.g., "foo", "hello.txt"). This helps you and Nix refer to the package.
  2.  **system:** Specifies the target architecture for the build (e.g., `builtins.currentSystem` for your current machine).
  3.  **builder:** Defines the program that will execute the build instructions (e.g., `bash`).

## Our First Simple Derivation: Understanding the Builder

- To understand how derivations work, let's create a very basic example using a bash script as our `builder`.

### Why a Builder Script?

- The `builder` attribute in a derivation tells Nix _how_ to perform the build steps. A simple and common way to define these steps is with a bash script.

### The Challenge with Shebangs in Nix

- In typical Unix-like systems, you might start a bash script with a shebang (`#!/bin/bash` or `#!/usr/bin/env bash`) to tell the system how to execute it. However, in Nix derivations, we generally avoid this.

- **Reason:** Nix builds happen in an isolated environment where the exact path to common tools like `bash` isn't known beforehand (it resides within the Nix store). Hardcoding a path or relying on the system's `PATH` would break Nix's stateless property.

### The Importance of Statelessness in Nix

- **Stateful Systems (Traditional):** When you install software traditionally, it often modifies the core system environment directly. This can lead to dependency conflicts and makes rollbacks difficult.

- **Stateless Systems (Nix):** Nix takes a different approach. When installing a package, it creates a unique, immutable directory in the Nix store. This means:
  - **No Conflicts:** Different versions of the same package can coexist without interfering with each other.
  - **Reliable Rollback:** You can easily switch back to previous versions without affecting system-wide files.
  - **Reproducibility:** Builds are more likely to produce the same result across different machines if they are "pure" (don't rely on external system state).

### Our `builder.sh` Script

- For our first derivation, we'll create a simple `builder.sh` file in the current directory:

```bash
# builder.sh
declare -xp
echo foo > $out
```

- The command `declare -xp` lists exported variables (it's a bash builtin function).

- - Nix needs to know where the final built product (the "cake" in our earlier analogy) should be placed. So, during the derivation process, Nix calculates a unique output path within the Nix store. This path is then made available to our builder script as an environment variable named `$out`. The `.drv` file, which is the recipe, contains instructions for the builder, including setting up this `$out` variable. Our builder script will then put the result of its work (in this case, the "foo" file) into this specific `$out` directory.

- As mentioned earlier we need to find the nix store path to the bash executable, common way to do this is to load Nixpkgs into the repl and check:

```bash
nix-repl> :l <nixpkgs>
Added 3950 variables.
nix-repl> "${bash}"
"/nix/store/ihmkc7z2wqk3bbipfnlh0yjrlfkkgnv6-bash-4.2-p45"
```

So, with this little trick we are able to refer to `bin/bash` and create our derivation:

```bash
nix-repl> d = derivation { name = "foo"; builder = "${bash}/bin/bash"; args = [ ./builder.sh ]; system = builtins.currentSystem; }
nix-repl> :b d
[1 built, 0.0 MiB DL]

this derivation produced the following outputs:
  out -> /nix/store/gczb4qrag22harvv693wwnflqy7lx5pb-foo
```

- Boom! The contents of `/nix/store/w024zci0x1hh1wj6gjq0jagkc1sgrf5r-foo` is really foo! We've built our first derivation.

- Derivations are the primitive that Nix uses to define packages. “Package” is a loosely defined term, but a derivation is simply the result of calling `builtins.derivation`.

## Our Second Derivation

The following is a simple `hello-drv` derivation:

```nix
nix-repl> hello-drv = nixpkgs.stdenv.mkDerivation {
            name = "hello.txt";
            unpackPhase = "true";
            installPhase = ''
              echo -n "Hello World!" > $out
            '';
          }

nix-repl> hello-drv
«derivation /nix/store/ad6c51ia15p9arjmvvqkn9fys9sf1kdw-hello.txt.drv»
```

- Derivations have a `.drv` suffix, as you can see the result of calling `hello-drv` is the nix store path to a derivation.

### Links and short Overview

- [NixPillsOurFirstDerivation](https://nixos.org/guides/nix-pills/06-our-first-derivation)

- [NixPills-WorkingDerivation](https://nixos.org/guides/nix-pills/07-working-derivation)

- [nix.dev-Derivations](https://nix.dev/manual/nix/2.24/language/derivations)

- [nix.dev-packagingExistingSoftware](https://nix.dev/tutorials/packaging-existing-software)

- [howToLearnNix-MyFirstDerivation](https://ianthehenry.com/posts/how-to-learn-nix/my-first-derivation/)

- [howToLearnNix-DerivationsInDetail](https://ianthehenry.com/posts/how-to-learn-nix/derivations-in-detail/)

- [Sparky/blog-creatingASuperSimpleDerivation](https://www.sam.today/blog/creating-a-super-simple-derivation-learning-nix-pt-3) # How to learn Nix

- [Sparky/blog-Derivations102](https://www.sam.today/blog/derivations-102-learning-nix-pt-4)

- [ScriveNixWorkshop-nixDerivationBasics](https://scrive.github.io/nix-workshop/04-derivations/01-derivation-basics.html)

- [zeroToNix-Derivations](https://zero-to-nix.com/concepts/derivations/)

- [Tweag-derivationOutputs](https://www.tweag.io/blog/2021-02-17-derivation-outputs-and-output-paths/)

- [theNixLectures-Derivations](https://ayats.org/blog/nix-tuto-2)

- [bmcgee-whatAreFixed-OutputDerivations](https://bmcgee.ie/posts/2023/02/nix-what-are-fixed-output-derivations-and-why-use-them/)
