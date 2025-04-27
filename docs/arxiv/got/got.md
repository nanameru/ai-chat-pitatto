# Graph of Thoughts (GoT) Summary

This document summarizes the "Graph of Thoughts" framework based on the [spcl/graph-of-thoughts](https://github.com/spcl/graph-of-thoughts) repository.

## Overview

*   **Concept:** Graph of Thoughts (GoT) is a framework designed to enhance the problem-solving capabilities of Large Language Models (LLMs).
*   **Method:** It models complex problems as a **Graph of Operations (GoO)**. The LLM acts as the engine to execute these operations defined within the graph structure.
*   **Flexibility:** The framework is designed to be flexible and extensible, allowing users to implement not only the novel GoT approach but also graph structures resembling previous methods like Chain-of-Thought (CoT) or Tree-of-Thoughts (ToT).
*   **Paper:** The official implementation of the paper "[Graph of Thoughts: Solving Elaborate Problems with Large Language Models](https://arxiv.org/pdf/2308.09687.pdf)".

## Key Features

*   **Graph-Based Problem Solving:** Allows representing problem-solving processes as graphs, enabling more complex reasoning patterns (e.g., aggregation, refinement, loops) than linear or tree-based methods.
*   **Operations:** Defines various operations that can be nodes in the graph (e.g., `Generate`, `Score`, `Aggregate`, `Refine`, `GroundTruth`).
*   **LLM Integration:** Uses an LLM (configurable, e.g., ChatGPT) as the core processing unit for executing graph operations.
*   **Controller:** Manages the execution of the graph, orchestrating the LLM calls and state transitions based on the defined GoO.
*   **Prompter & Parser:** Handles the interaction with the LLM, formatting inputs (prompts) and parsing outputs.

## Setup

1.  **Prerequisites:** Python 3.8 or newer.
2.  **Installation (User):**
    ```bash
    pip install graph_of_thoughts
    ```
3.  **Installation (Developer):**
    ```bash
    git clone https://github.com/spcl/graph-of-thoughts.git
    cd graph-of-thoughts
    pip install -e .
    ```
4.  **LLM Configuration:** Requires configuring access to an LLM (e.g., setting up API keys in a `config.json` file).

## Usage Example (CoT-like Sorting)

```python
from examples.sorting.sorting_032 import SortingPrompter, SortingParser, utils
from graph_of_thoughts import controller, language_models, operations

# Input
to_be_sorted = "[0, 2, 6, ...]" # List of numbers

# Define Graph of Operations (GoO)
gop = operations.GraphOfOperations()
gop.append_operation(operations.Generate())
gop.append_operation(operations.Score(scoring_function=utils.num_errors))
gop.append_operation(operations.GroundTruth(utils.test_sorting))

# Configure LLM
lm = language_models.ChatGPT("config.json", model_name="chatgpt")

# Create Controller
ctrl = controller.Controller(
  lm,
  gop,
  SortingPrompter(),
  SortingParser(),
  {"original": to_be_sorted, "current": "", "method": "cot"} # Initial state
)

# Run and Output
ctrl.run()
ctrl.output_graph("output_cot.json")
```
*(A similar example is provided in the repository for the more complex GoT approach).*

## Repository Structure

*   `graph_of_thoughts/`: Core library code (controller, operations, language models, etc.).
*   `examples/`: Usage examples for various problems (sorting, keyword counting) with READMEs.
*   `paper/`: Information related to the research paper and results.

## Documentation & Resources

*   The [research paper](https://arxiv.org/pdf/2308.09687.pdf) provides a high-level overview.
*   Code is documented, with key modules being `Controller` and `Operations`.
*   The `examples/` directory serves as a practical guide.

## Citation

The repository provides a BibTeX entry for citation if used in research. 