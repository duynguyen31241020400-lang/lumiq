export interface Exercise {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  targetConcepts: string[];
  difficulty: number;
  commonError?: string;
}

export const exercises: Exercise[] = [
  {
    id: "ex_01_hello",
    title: "Hello World",
    description: 'Print your name and a greeting.',
    starterCode: '# Print "Hello, [your name]!"\n# Then print your age\n\n',
    targetConcepts: ["print function", "string literals"],
    difficulty: 1,
  },
  {
    id: "ex_02_conditional",
    title: "Grade Checker",
    description:
      'Write a function that returns "Pass" if score >= 50, else "Fail".',
    starterCode:
      "def check_grade(score):\n    # Write your logic here\n    \n\nprint(check_grade(75))\nprint(check_grade(30))\n",
    targetConcepts: ["if/else", "function return", "comparison operators"],
    difficulty: 1,
    commonError: "elif confusion, missing return",
  },
  {
    id: "ex_03_loop",
    title: "Sum Calculator",
    description: "Write a function that sums all numbers from 1 to n.",
    starterCode:
      "def sum_to_n(n):\n    total = 0\n    # Use a loop\n    \n    return total\n\nprint(sum_to_n(10))  # Should print 55\n",
    targetConcepts: ["for loop", "range()", "accumulator pattern"],
    difficulty: 2,
    commonError: "range off by one, forgetting to return",
  },
  {
    id: "ex_04_function",
    title: "Safe Divider",
    description:
      "Write a function that divides two numbers safely (no division by zero).",
    starterCode:
      "def safe_divide(a, b):\n    # What happens if b is 0?\n    \n\nprint(safe_divide(10, 2))   # 5.0\nprint(safe_divide(10, 0))   # Should handle this\n",
    targetConcepts: ["conditional", "edge cases", "None return"],
    difficulty: 2,
    commonError: "missing zero check — classic missing_prerequisite",
  },
  {
    id: "ex_05_list",
    title: "List Filter",
    description:
      "Write a function that returns only the even numbers from a list.",
    starterCode:
      "def get_evens(numbers):\n    result = []\n    # Loop and filter\n    \n    return result\n\nprint(get_evens([1, 2, 3, 4, 5, 6]))  # [2, 4, 6]\n",
    targetConcepts: ["list iteration", "modulo operator", "append"],
    difficulty: 2,
    commonError: "modulo confusion, forgetting append",
  },
];
