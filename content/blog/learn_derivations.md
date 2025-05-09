+++
title = "Derivations Explained & Resources"
date = 2025-05-07
+++

## Derivations

- A derivation in Nix is a core concept that describes how to build a piece of software or a resource (e.g., a package, library, or configuration file). For beginners, you can think of a derivation as a recipe for cooking a dish. Just as a recipe lists ingredients (dependencies), steps (build instructions), and the final dish (output), a derivation tells Nix what inputs to use, how to build something, and what the result will be.

- To create a package definition in Nix, developers typically use mkDerivation, which is the standard approach provided by stdenv. While the built-in derivation function exists for lower-level use cases requiring fine-grained control, mkDerivation streamlines the process by handling dependencies and build environments automatically. This function takes a set of attributes as its main input, defining all the details of how to build your software or resource. At a minimum, this set needs to include the following three essential attributes:

1.  **name:** This is a human-readable name for your derivation, like "foo" in our upcoming example. It helps identify the package you are building.
2.  **system:** This attribute specifies the target system architecture for which you are building (e.g., `builtins.currentSystem`, which means build for the system Nix is currently running on).
3.  **builder:** This attribute tells Nix _how_ to build the output. It's the program that will execute the build steps, like our `bash` example.

### The Builder

So the derivation is like the recipe, the builder is what executes the recipe.

- The most simple way to execute a sequence of commands is probably a bash script, so we'll use bash as our builder with the script being the sequence of commands. The problem with Nix is that upfront it has no way of knowing what the path to `bash` will be until we actually build it preventing us from using hashbang or shebang in our script (i.e. `#!/usr/bin/env bash`). While you might have bash installed on your current system and could use a hashbang, doing so would tie your build to that specific system's environment, thus losing the cool stateless property of Nix. (stateful = traditional where if you make a change the changes are saved directly to the computer) (stateless = When you "install" a program in Nix, it doesn't directly modify the core system. Instead it creates a unique store path allowing multiple versions of the same program)

- To further clarify, Traditional package management systems modify a system’s core environment when installing a program (stateful installation). This means changes persist directly within the system, which can lead to dependency conflicts and make rollback difficult.

Nix, on the other hand, ensures stateless installations—instead of modifying the base system, it creates immutable store paths for each package, allowing multiple versions to coexist seamlessly. This approach:

- Eliminates conflicts (different versions of the same package can exist side by side).

- Enables reliable rollback (switch back to a previous version without affecting system-wide files).

- Guarantees reproducibility (builds behave the same way regardless of the machine, if built pure).

- With all of that noted, we'll create our `builder.sh` in the current directory:

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

## Another More Simple Example

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
