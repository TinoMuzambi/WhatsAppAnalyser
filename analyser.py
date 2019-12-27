# WhatsApp Chat Analyser
# Tino Muzambi
# 26 November 2019
import io
from prettytable import PrettyTable

first_name = ""
second_name = ""


def extract_names(file_list):
    """
    Extract the names of the people in the chat for use in other parts of the program.
    :param file_list: list of text file contents.
    """
    if "changed their phone number." in file_list[1]:       # Edge cases
        first = file_list[2]
        second = file_list[3]
    elif not file_list[2][0].isdigit():
        first = file_list[1]
        second = file_list[3]
        num = 3
        while not file_list[num][0].isdigit():
            num += 1
            second = file_list[num]
    else:
        first = file_list[1]                               # Else all goes well, and names are lines 2 & 3
        second = file_list[2]

    global first_name
    first_name = first[20:]
    pos = first_name.find(":")
    first_name = first_name[:pos]

    global second_name
    second_name = second[20:]
    pos = second_name.find(":")
    second_name = second_name[:pos]

    i = 2
    while first_name == second_name:
        i += 1
        second = file_list[i]
        second_name = second[20:]
        pos = second_name.find(":")
        second_name = second_name[:pos]


def get_msg_list(file_list):
    """
    Process initial list to produce a list where each element is a whole message instead of a line.
    :param file_list: list of text file contents.
    :return: transformed list.
    """
    out_list = []
    i = -1
    file_list = file_list[1:]           # Ignore first line.
    for line in file_list:
        i += 1
        if first_name in line:
            out_list.append(line)
        elif second_name in line:
            out_list.append(line)
        else:
            curr_msg = out_list[i - 1]
            curr_msg += line
            out_list[i - 1] = curr_msg
            i -= 1
    return out_list


def count_words(line, name):
    """
    Count the number of words in a string.
    :param line: the string being counted.
    :param name: name of the person in the string to exclude that from the count.
    :return: number of words in the string.
    """
    line_no_name = line[len(name) + 22:]
    if " " in line_no_name:
        line_no_name = line_no_name.split()
        return len(line_no_name)
    return 1


def rm_unwanted_chars(input_string):
    """
    Remove unwanted characters including emojis from end and beginning of strings.
    :param input_string: string to be processed.
    :return: string with all unwanted characters removed.
    Unwanted characters:
    emojis
    .
    ,
    ?
    !
    :
    ;
    (
    )
    -
    *
    _
    [
    ]
    /
    \
    {
    }
    """
    return input_string.encode('ascii', 'ignore').decode('ascii').strip(".").strip(",").strip("?").strip("!") \
        .strip(":").strip(";").strip("(").strip(")").strip("-").strip("*").strip("_").strip("`").strip("[").strip("]")\
        .strip("/").strip("\\").strip("{").strip("}")


def get_indiv_common_words(file_list, first):
    """
    Populates dictionary with count of words used in the chat by either person depending on boolean.
    :param file_list: list of text file contents.
    :param first: boolean for either first or second person
    :return: dictionary with count of words.
    """
    words_count_dict = {}
    for line in file_list:
        if first:
            if first_name in line:
                line = line[22 + len(first_name):]
                line = line.split()
                for word in line:
                    word = rm_unwanted_chars(word)
                    if word == "":
                        continue
                    word = word.lower()
                    if word in words_count_dict:
                        words_count_dict[word] = words_count_dict[word] + 1
                    else:
                        words_count_dict[word] = 1
        else:
            if second_name in line:
                line = line[22 + len(second_name):]
                line = line.split()
                for word in line:
                    word = rm_unwanted_chars(word)
                    if word == "":
                        continue
                    word = word.lower()
                    if word in words_count_dict:
                        words_count_dict[word] = words_count_dict[word] + 1
                    else:
                        words_count_dict[word] = 1
    return words_count_dict


def get_common_words(file_list):
    """
    Populates dictionary with count of words used in the chat.
    :param file_list: list of text file contents.
    :return: dictionary with count of words.
    """
    words_count_dict = {}
    for line in file_list:
        if first_name in line:
            line = line[22 + len(first_name):]
        else:
            line = line[22 + len(second_name):]
        line = line.split()
        for word in line:
            word = rm_unwanted_chars(word)
            if word == "":
                continue
            word = word.lower()
            if word in words_count_dict:
                words_count_dict[word] = words_count_dict[word] + 1
            else:
                words_count_dict[word] = 1
    return words_count_dict


def main():
    file_name = input("Enter the name of the text file:\n")

    with io.open(file_name, "r", encoding="utf-8") as text:
        file_list = text.readlines()
    text.close()

    extract_names(file_list)
    conv_file_list = get_msg_list(file_list)
    words_count_dict = get_common_words(conv_file_list)
    first_words_count_dict = get_indiv_common_words(conv_file_list, True)
    second_words_count_dict = get_indiv_common_words(conv_file_list, False)

    first_total_msg = 0
    second_total_msg = 0
    first_total_words = 0
    second_total_words = 0
    count = 0
    for line in conv_file_list:
        if "<Media omitted>" not in line:
            if first_name in line:
                count += 1
                first_total_msg += 1
                num_words = count_words(line, first_name)
                first_total_words += num_words
            elif second_name in line:
                count += 1
                second_total_msg += 1
                num_words = count_words(line, second_name)
                second_total_words += num_words

    print("\n===========================================================================================\n")
    print("WhatsApp chat statistics for conversation between {} and {}".format(first_name, second_name))
    print("\n===========================================================================================\n")
    print("{:6} total messages.\n".format(count))

    print("{:6} total messages for {}.".format(first_total_msg, first_name))
    print("{:6} total messages for {}.\n".format(second_total_msg, second_name))

    print("{:6} total words for {}.".format(first_total_words, first_name))
    print("{:6} total words for {}.\n".format(second_total_words, second_name))

    print("{:2.2f} average message length for {}.".format(first_total_words / first_total_msg, first_name))
    print("{:2.2f} average message length for {}.\n".format(second_total_words / second_total_msg, second_name))

    print("Top 30 most used words:")
    words_count_dict.pop("<media")              # Not very elegant, needs work.
    words_count_dict.pop("omitted>")
    first_words_count_dict.pop("<media")
    first_words_count_dict.pop("omitted>")
    second_words_count_dict.pop("<media")
    second_words_count_dict.pop("omitted>")

    top = PrettyTable(["Number", "Word", "Count"])
    for i in range(30):
        high = max(words_count_dict.values())
        curr = list(words_count_dict.keys())[list(words_count_dict.values()).index(high)]
        top.add_row([i + 1, curr, high])
        words_count_dict.pop(curr)
    print(top)

    first_top = PrettyTable(["Number", "Word", "Count"])
    print("\nTop 30 most used words by {}:".format(first_name))
    for i in range(30):
        high = max(first_words_count_dict.values())
        curr = list(first_words_count_dict.keys())[list(first_words_count_dict.values()).index(high)]
        first_top.add_row([i + 1, curr, high])
        first_words_count_dict.pop(curr)
    print(first_top)

    print("\nTop 30 most used words by {}:".format(second_name))
    second_top = PrettyTable(["Number", "Word", "Count"])
    for i in range(30):
        high = max(second_words_count_dict.values())
        curr = list(second_words_count_dict.keys())[list(second_words_count_dict.values()).index(high)]
        second_top.add_row([i + 1, curr, high])
        second_words_count_dict.pop(curr)
    print(second_top)

    word_count_file = open("word_count.txt", "w")
    print(words_count_dict, file = word_count_file)
    word_count_file.close()


if __name__ == '__main__':
    main()
