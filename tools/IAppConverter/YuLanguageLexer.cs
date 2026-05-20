using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace IAppConverter
{
    /// <summary>
    /// 裕语言词法分析器 - 将裕语言代码转换为 Token 流
    /// </summary>
    public class YuLanguageLexer
    {
        // 裕语言关键字映射到 C#
        private static readonly Dictionary<string, string> KeywordMap = new Dictionary<string, string>
        {
            { "sy", "private static" },
            { "s", "var" },
            { "ff", "public" },
            { "qj ff", "public static" },
            { "rg", "if" },
            { "xh", "for" },
            { "fh", "return" },
            { "shi", "true" },
            { "fou", "false" }
        };

        public enum TokenType
        {
            Keyword,
            Identifier,
            Number,
            String,
            Operator,
            JavaBlock,
            Whitespace,
            Comment,
            Unknown
        }

        public class Token
        {
            public TokenType Type { get; set; }
            public string Value { get; set; }
            public string CSharpValue { get; set; }
            public int Line { get; set; }
            public int Column { get; set; }

            public Token(TokenType type, string value, int line, int column)
            {
                Type = type;
                Value = value;
                Line = line;
                Column = column;
                
                // 自动转换关键字
                if (type == TokenType.Keyword && KeywordMap.ContainsKey(value))
                {
                    CSharpValue = KeywordMap[value];
                }
                else
                {
                    CSharpValue = value;
                }
            }
        }

        /// <summary>
        /// 词法分析主函数
        /// </summary>
        public List<Token> Tokenize(string sourceCode)
        {
            var tokens = new List<Token>();
            int line = 1;
            int column = 1;
            int i = 0;

            while (i < sourceCode.Length)
            {
                // 跳过空白字符
                if (char.IsWhiteSpace(sourceCode[i]))
                {
                    if (sourceCode[i] == '\n')
                    {
                        line++;
                        column = 1;
                    }
                    else
                    {
                        column++;
                    }
                    i++;
                    continue;
                }

                // 注释处理
                if (i + 1 < sourceCode.Length && sourceCode[i] == '/' && sourceCode[i + 1] == '/')
                {
                    int start = i;
                    while (i < sourceCode.Length && sourceCode[i] != '\n')
                    {
                        i++;
                    }
                    tokens.Add(new Token(TokenType.Comment, sourceCode.Substring(start, i - start), line, column));
                    continue;
                }

                // Java 代码块处理
                if (sourceCode.Substring(i).StartsWith("java {"))
                {
                    int start = i;
                    int braceCount = 0;
                    i += 5; // 跳过 "java "
                    
                    while (i < sourceCode.Length)
                    {
                        if (sourceCode[i] == '{') braceCount++;
                        else if (sourceCode[i] == '}')
                        {
                            braceCount--;
                            if (braceCount == 0)
                            {
                                i++;
                                break;
                            }
                        }
                        if (sourceCode[i] == '\n')
                        {
                            line++;
                            column = 1;
                        }
                        i++;
                    }
                    
                    tokens.Add(new Token(TokenType.JavaBlock, sourceCode.Substring(start, i - start), line, column));
                    continue;
                }

                // 字符串字面量
                if (sourceCode[i] == '"')
                {
                    int start = i;
                    i++;
                    while (i < sourceCode.Length && sourceCode[i] != '"')
                    {
                        if (sourceCode[i] == '\\') i++; // 跳过转义字符
                        i++;
                    }
                    i++; // 跳过结束引号
                    tokens.Add(new Token(TokenType.String, sourceCode.Substring(start, i - start), line, column));
                    column += i - start;
                    continue;
                }

                // 数字字面量
                if (char.IsDigit(sourceCode[i]))
                {
                    int start = i;
                    while (i < sourceCode.Length && (char.IsDigit(sourceCode[i]) || sourceCode[i] == '.'))
                    {
                        i++;
                    }
                    tokens.Add(new Token(TokenType.Number, sourceCode.Substring(start, i - start), line, column));
                    column += i - start;
                    continue;
                }

                // 标识符和关键字
                if (char.IsLetter(sourceCode[i]) || sourceCode[i] == '_')
                {
                    int start = i;
                    while (i < sourceCode.Length && (char.IsLetterOrDigit(sourceCode[i]) || sourceCode[i] == '_'))
                    {
                        i++;
                    }
                    
                    string word = sourceCode.Substring(start, i - start);
                    
                    // 检查是否是 "qj ff" 组合关键字
                    if (word == "qj" && i < sourceCode.Length)
                    {
                        int j = i;
                        while (j < sourceCode.Length && char.IsWhiteSpace(sourceCode[j])) j++;
                        if (j + 2 <= sourceCode.Length && sourceCode.Substring(j, 2) == "ff")
                        {
                            tokens.Add(new Token(TokenType.Keyword, "qj ff", line, column));
                            i = j + 2;
                            column += i - start;
                            continue;
                        }
                    }
                    
                    // 检查是否是关键字
                    TokenType type = KeywordMap.ContainsKey(word) ? TokenType.Keyword : TokenType.Identifier;
                    tokens.Add(new Token(type, word, line, column));
                    column += i - start;
                    continue;
                }

                // 操作符
                tokens.Add(new Token(TokenType.Operator, sourceCode[i].ToString(), line, column));
                i++;
                column++;
            }

            return tokens;
        }

        /// <summary>
        /// 将 Token 流转换为 C# 代码
        /// </summary>
        public string TokensToCSharp(List<Token> tokens)
        {
            var sb = new StringBuilder();
            
            foreach (var token in tokens)
            {
                if (token.Type == TokenType.JavaBlock)
                {
                    sb.AppendLine("// TODO: 手动审查 Java 代码块");
                    sb.AppendLine("// " + token.Value.Replace("\n", "\n// "));
                }
                else
                {
                    sb.Append(token.CSharpValue);
                    if (token.Type == TokenType.Keyword || token.Type == TokenType.Identifier)
                    {
                        sb.Append(" ");
                    }
                }
            }
            
            return sb.ToString();
        }
    }
}
