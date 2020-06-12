# WhatsApp Chat Analyser
# Tino Muzambi
# 26 November 2019
from flask import Flask, render_template, request
from prettytable import PrettyTable
from wtforms import Form, TextAreaField, validators

app = Flask(__name__)
first_name = ""
second_name = ""


def checks(form, field):
    """Form validation: failure if chat too short"""
    chat = form.chat.data
    chat = chat.split("\n")
    if len(chat) < 60:
        raise validators.ValidationError(
            "Chat too short, please use a longer chat."
        )


class InputForm(Form):
    chat = TextAreaField('Text', render_kw={"rows": 15, "cols": 100},
                         validators=[validators.InputRequired(), checks])


def extract_names(file_list):
    """
    Extract the names of the people in the chat for use in other parts of the program.
    :param file_list: list of text file contents.
    """
    if "changed their phone number." in file_list[1]:  # Edge cases
        first = file_list[2]
        second = file_list[3]
    elif not file_list[2][0].isdigit():
        first = file_list[1]
        second = file_list[3]
        num = 3
        while not file_list[num].lstrip("\n")[0].isdigit():
            num += 1
            if num == len(file_list):
                raise validators.ValidationError(
                    "You used a poorly formatted file. Please ensure you use an exported file from WhatsApp as is with media ommitted.")
            second = file_list[num]
    else:
        first = file_list[1]  # Else all goes well, and names are lines 2 & 3
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
        if i == len(file_list) + 1:
            raise validators.ValidationError("Poorly formatted file.")
        if file_list[i].lstrip("\n")[0].isdigit():
            second = file_list[i]
            second_name = second[20:]
            pos = second_name.find(":")
            second_name = second_name[:pos]
    first_name = first_name.strip(" ")
    second_name = second_name.strip(" ")


def get_msg_list(file_list):
    """
    Process initial list to produce a list where each element is a whole message instead of a line.
    :param file_list: list of text file contents.
    :return: transformed list.
    """
    out_list = []
    i = -1
    file_list = file_list[1:]  # Ignore first line.
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
        .strip(":").strip(";").strip("(").strip(")").strip("-").strip("*").strip("_").strip("`").strip("[").strip("]") \
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


@app.route('/', methods=['GET', 'POST'])
def precursor():
    form = InputForm(request.form)
    if request.method == 'POST' and form.validate():
        result = process_chat(form.chat.data)
    else:
        result = None
    return render_template('index.html', form=form, result=result)


def process_chat(chat_file):
    file_list = chat_file.split("\r")
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
    lnum_words = -1
    chat_result = ""
    for line in conv_file_list:
        if "<Media omitted>" not in line:
            if first_name in line:
                count += 1
                first_total_msg += 1
                num_words = count_words(line, first_name)
                # if num_words > lnum_words:
                #     longest_msg = open("longest.txt", "w")
                #     lnum_words = num_words
                #     print(line, file = longest_msg)
                #     longest_msg.close()
                first_total_words += num_words
            elif second_name in line:
                count += 1
                second_total_msg += 1
                num_words = count_words(line, second_name)
                # if num_words > lnum_words:
                #     longest_msg = open("longest.txt", "w")
                #     lnum_words = num_words
                #     print(line, file = longest_msg)
                #     longest_msg.close()
                second_total_words += num_words

    print(first_name)
    print(second_name)
    chat_result += "\n===========================================================================================\n"
    chat_result += "WhatsApp chat statistics for conversation between {} and {}".format(first_name, second_name)
    chat_result += "\n===========================================================================================\n"
    chat_result += "{:6} total messages.\n".format(count)

    chat_result += "{:6} total messages for {}.".format(first_total_msg, first_name) + "\n"
    chat_result += "{:6} total messages for {}.\n".format(second_total_msg, second_name) + "\n"

    chat_result += "{:6} total words for {}.".format(first_total_words, first_name) + "\n"
    chat_result += "{:6} total words for {}.\n".format(second_total_words, second_name) + "\n"

    chat_result += "{:2.2f} average message length for {}.".format(first_total_words / first_total_msg,
                                                                   first_name) + "\n"
    chat_result += "{:2.2f} average message length for {}.\n".format(second_total_words / second_total_msg,
                                                                     second_name) + "\n"

    try:
        first_words_count_dict.pop("<media")  # Not very elegant, needs work.
        first_words_count_dict.pop("omitted>")
        second_words_count_dict.pop("<media")
        second_words_count_dict.pop("omitted>")
    except KeyError:
        pass

    first_top = PrettyTable(["Number", "Word", "Count"])
    chat_result += "\nTop 30 most used words by {}:".format(first_name) + "\n"
    for i in range(30):
        high = max(first_words_count_dict.values())
        curr = list(first_words_count_dict.keys())[list(first_words_count_dict.values()).index(high)]
        first_top.add_row([i + 1, curr, high])
        first_words_count_dict.pop(curr)
    chat_result += first_top.get_string() + "\n"

    chat_result += "\nTop 30 most used words by {}:".format(second_name) + "\n"
    second_top = PrettyTable(["Number", "Word", "Count"])
    for i in range(30):
        high = max(second_words_count_dict.values())
        curr = list(second_words_count_dict.keys())[list(second_words_count_dict.values()).index(high)]
        second_top.add_row([i + 1, curr, high])
        second_words_count_dict.pop(curr)
    chat_result += second_top.get_string()

    # TODO Fix brother bug.
    # brother is appearing in the full dictionary but not in the individual dictionaries.
    # print("Search Function")
    # print("Options:\n0. quit\n1. Search words used by {}".format(first_name))
    # print("2. Search words used by {}".format(second_name))
    # resp = eval(input())
    # while resp != 0:
    #     if resp == 1:
    #         search_word = input("Enter the word you want to search for:\n")
    #         try:
    #             print("{} used '{}' {} times.".format(first_name, search_word, str(first_words_count_dict[search_word])))
    #         except KeyError:
    #             print("{} never used the word '{}'.".format(first_name, search_word))
    #     else:
    #         search_word = input("Enter the word you want to search for:\n")
    #         try:
    #             print("{} used '{}' {} times.".format(second_name, search_word, str(second_words_count_dict[search_word])))
    #         except KeyError:
    #             print("{} never used the word '{}'.".format(second_name, search_word))
    #     print("Options:\n0. quit\n1. Search words used by {}".format(first_name))
    #     print("2. Search words used by {}".format(second_name))
    #     resp = eval(input())
    #
    # word_count_file = open("word_count.txt", "w")
    # print(first_name)
    # print(first_words_count_dict, file=word_count_file)
    # word_count_file.close()
    return chat_result


if __name__ == '__main__':
    app.run(debug=True)
