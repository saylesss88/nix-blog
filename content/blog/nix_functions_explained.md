+++
title = "Nix Functions Explained"
date = 2025-05-05
+++

## Nix Functions

Functions are all over Nix Code and an important concept to grasp to start understanding Nix.

In Nix, all functions conceptually take exactly one argument. Multi-argument functions are done through a series of nested single-argument functions (currying).

Argument and function body are separated by a colon (`:`).

Wherever you find a colon (`:`) in Nix code:

- On its left is the function argument

- On its right is the function body. The "function body" is the expression evaluated when the function is called.

- Function arguments are another way to assign names to values. Values aren't known in advance: the names are placeholders that are filled when calling the function.

For example:

```nix
greet = personName: "Hello, ${personName}!"
```

- In the above example `personName` is a placeholder (the argument name).

- The actual value for `personName` is provided when you call the function:

```nix
greet "Anonymous"   # Evaluates to "Hello, Anonymous!"
```

## Function Declarations

- Single argument

```nix
inc = x: x + 1
inc 5  # Evaluates to 6
```

- Multiple arguments via nesting (currying)

- Currying is the process of transforming a function with multiple arguments into a sequence of functions each taking a single argument.

```nix
concat = x: y: x + y
concat 6 6   # Evaluates to 12
```

- Nix sees the colons as separators for single-argument functions that return other functions.

```nix
greeting = prefix: name: "${prefix}, ${name}!";
```

Think of this as a chain of single-argument functions:

1. Outer Function: `prefix: (name: "${prefix}, ${name}!")`

- This function takes one argument, `prefix`.

- Its body is the definition of another function.

2. Inner Function: `name: "${prefix}, ${name}!"`

- This function (which is the result of the outer function) takes one argument, `name`.

- Its body is the string interpolation, which can still access the `prefix` from the outer function's scope.

Step-by-Step Evaluation of this Multi-Argument Call:

When you write `greeting "Hello" "Alice"`, Nix evaluates it like this:

1. `greeting "Hello"`

- The `greeting` function is called with the argument `"Hello"`.

- The outer function `prefix: ...` is executed, with `prefix` being assigned `"Hello"`.

- The result of this execution is the _inner_ function: `name: "Hello, ${name}!"`

2. `(greeting "Hello") "Alice"`:

- The result of the first step (the inner function) is now called with the argument `"Alice"`.

- The inner function `name: "Hello, ${name}!"` is executed, with `name` being assigned `"Alice"`.

- The body `"Hello, ${name}!"` is evaluated, resulting in `"Hello, Alice!"`

> Every colon you see in a function definition separates a single argument (on its left) from its corresponding function body (on its right). Even when the body is another function definition.

- In `x: x + 1`: One argument `x`, One colon, & one body `x + 1`

- In `prefix: name: "${prefix}, ${name}!"`: The first colon separates `prefix` from the rest (`name: "${prefix}, ${name}!"`), which is the body of the first function. The second colon separates `name` (the argument of the inner function) from its body (`"${prefix}, ${name}!"`).

### Partial Application

Because Nix functions are curried, you can apply arguments one at a time. This is known as partial application. When you apply a function to some, but not all, of its expected arguments, you get a new function that "remembers" the arguments you've already provided and is waiting for the remaining ones.

Revisiting our `greeting` function:

```nix
greeting = prefix: name: "${prefix}, ${name}!";
```

If we only provide the `prefix`:

```nix
helloGreeting = greeting "Hello";
```

- `helloGreeting` is a new function that partially applies our `greeting` function. This new function only requires a single argument.

```nix
helloGreeting "Sally"  # Evaluates to "Hello, Sally!"
```

- Partial application can be used for creating specialized functions. This allows you to create more specific functions from more general ones by fixing some of their arguments.

- Many higher-order functions (functions that take other functions as arguments, like `map` or `filter`) expect functions with a specific number of arguments. Partial application allows you to adapt existing functions to fit these expectations by pre-filling some of their parameters.

### Most NixOS and home-manager modules are actually functions

It's important to recognize that the function paradigm is central to how NixOS and Home Manager modules are structured. Most NixOS and Home Manager modules are fundamentally functions.

- These module functions typically accept a single argument, an attribute set.

For example, a simplified service module could be:

```nix
{ config, lib, pkgs, ... }: {
  services.nginx.enable = true;
  services.nginx.package = pkgs.nginx;
  services.nginx.settings.http-port = "8080";
}
```

- Here, the entire module is a function that takes one argument: `{ config, lib, pkgs, ... }`.

- When you add this module to your configuration, the module system calls this function with a specific attribute set containing the current configuration, the Nix library (`lib`), the available packages (`pkgs`), and other relevant info.

#### Resources

- [nix.dev Nix Lang Basics](https://nix.dev/tutorials/nix-language.html)

- [nix pills Functions and Imports](https://nixos.org/guides/nix-pills/05-functions-and-imports.html)

- [zero-to-nix Nix Lang](https://zero-to-nix.com/concepts/nix-language/)

- [A tour of Nix "Functions"](https://nixcloud.io/tour/?id=functions%2Fintroduction)

- [learn Nix in y minutes](https://learnxinyminutes.com/nix/)

- [noogle function library](https://noogle.dev/)
