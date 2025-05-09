+++
title = "Derivation Overview & Learning Resources"
date = 2025-05-07
+++

## Derivations

A derivation in Nix is a core concept that describes how to build a piece of software or a resource (e.g., a package, library, or configuration file). For beginners, you can think of a derivation as a recipe for cooking a dish. Just as a recipe lists ingredients (dependencies), steps (build instructions), and the final dish (output), a derivation tells Nix what inputs to use, how to build something, and what the result will be.

### Links and short Overview

- [NixPillsOurFirstDerivation](https://nixos.org/guides/nix-pills/06-our-first-derivation)

- The derivation function receives a set as its first argument. This set requires at least the following three attributes:

1. name
2. system
3. builder

- [NixPills-WorkingDerivation](https://nixos.org/guides/nix-pills/07-working-derivation)

- Create a derivation that actually builds something. Then package a real program: compile a simple C file and create a derivation out of it, given a blessed toolchain.

- [nix.dev-Derivations](https://nix.dev/manual/nix/2.24/language/derivations)

- The most important built-in function is `derivation`, which is used to describe a single derivation: a specification for running an executable on precisely defined input files to repeatable produce output files at uniquely determined file system paths.

- [nix.dev-packagingExistingSoftware](https://nix.dev/tutorials/packaging-existing-software)
- Create nix derivations to package C/C++ software, taking advantage of the Nixpkgs Standard Environment(`stdenv`), which automates much of the work.

- [howToLearnNix-MyFirstDerivation](https://ianthehenry.com/posts/how-to-learn-nix/my-first-derivation/)

- [howToLearnNix-DerivationsInDetail](https://ianthehenry.com/posts/how-to-learn-nix/derivations-in-detail/)

- [Sparky/blog-creatingASuperSimpleDerivation](https://www.sam.today/blog/creating-a-super-simple-derivation-learning-nix-pt-3) # How to learn Nix

- [Sparky/blog-Derivations102](https://www.sam.today/blog/derivations-102-learning-nix-pt-4)

- [ScriveNixWorkshop-nixDerivationBasics](https://scrive.github.io/nix-workshop/04-derivations/01-derivation-basics.html)

Standard Derivation

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

- [zeroToNix-Derivations](https://zero-to-nix.com/concepts/derivations/)

- [Tweag-derivationOutputs](https://www.tweag.io/blog/2021-02-17-derivation-outputs-and-output-paths/)

- [theNixLectures-Derivations](https://ayats.org/blog/nix-tuto-2)

- Derivations are the privimite that Nix uses to define packages. “Package” is a loosely defined term, but a derivation is simply the result of calling `builtins.derivation`.

- [bmcgee-whatAreFixed-OutputDerivations](https://bmcgee.ie/posts/2023/02/nix-what-are-fixed-output-derivations-and-why-use-them/)

- Whilst normal derivations are not allowed network access, _fixed-output-derivations_ are a compromise for situations like this. They provide the network access but in return they must **declare in advance a hash of their contents**
