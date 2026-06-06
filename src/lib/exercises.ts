export interface Exercise {
  id: string;
  title: string;
  filename: string;
  description: string;
  starterCode: string;
  targetConcepts: string[];
  difficulty: number;
  commonError?: string;
}

export const exercises: Exercise[] = [
  {
    id: "ex_01_hello",
    title: "Xin chào thế giới",
    filename: "hello_world.py",
    description: "In tên và lời chào của bạn.",
    starterCode: '# Print "Hello, [your name]!"\n# Then print your age\n\n',
    targetConcepts: ["print function", "string literals"],
    difficulty: 1,
  },
  {
    id: "ex_02_conditional",
    title: "Kiểm tra điểm",
    filename: "grade_checker.py",
    description:
      'Viết hàm trả về "Pass" nếu điểm >= 50, ngược lại "Fail".',
    starterCode:
      "def check_grade(score):\n    # Write your logic here\n    \n\nprint(check_grade(75))\nprint(check_grade(30))\n",
    targetConcepts: ["if/else", "function return", "comparison operators"],
    difficulty: 1,
    commonError: "elif confusion, missing return",
  },
  {
    id: "ex_03_loop",
    title: "Tính tổng",
    filename: "sum_calculator.py",
    description: "Viết hàm tính tổng các số từ 1 đến n.",
    starterCode:
      "def sum_to_n(n):\n    total = 0\n    # Use a loop\n    \n    return total\n\nprint(sum_to_n(10))  # Should print 55\n",
    targetConcepts: ["for loop", "range()", "accumulator pattern"],
    difficulty: 2,
    commonError: "range off by one, forgetting to return",
  },
  {
    id: "ex_04_function",
    title: "Chia an toàn",
    filename: "safe_divider.py",
    description:
      "Viết hàm chia hai số an toàn (không chia cho 0).",
    starterCode:
      "def safe_divide(a, b):\n    # What happens if b is 0?\n    \n\nprint(safe_divide(10, 2))   # 5.0\nprint(safe_divide(10, 0))   # Should handle this\n",
    targetConcepts: ["conditional", "edge cases", "None return"],
    difficulty: 2,
    commonError: "missing zero check — classic missing_prerequisite",
  },
  {
    id: "ex_05_list",
    title: "Lọc danh sách",
    filename: "list_filter.py",
    description:
      "Viết hàm trả về chỉ các số chẵn trong một danh sách.",
    starterCode:
      "def get_evens(numbers):\n    result = []\n    # Loop and filter\n    \n    return result\n\nprint(get_evens([1, 2, 3, 4, 5, 6]))  # [2, 4, 6]\n",
    targetConcepts: ["list iteration", "modulo operator", "append"],
    difficulty: 2,
    commonError: "modulo confusion, forgetting append",
  },
];
