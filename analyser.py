# WhatsApp Analyser
# Tino Muzambi
# 26 November 2019
import io

first_name = ""
second_name = ""


def extract_names(conv_file):
    # Edge cases:
    if "changed their phone number." in conv_file[1]:
        first_line = conv_file[2]
        second_line = conv_file[3]
    elif not conv_file[2][0].isdigit():
        first_line = conv_file[1]
        second_line = conv_file[3]
        num = 3
        while not conv_file[num][0].isdigit():
            num += 1
            second_line = conv_file[num]
    else:
        first_line = conv_file[1]
        second_line = conv_file[2]
    i = 2   
    global first_name
    first_name = first_line[20:]
    pos = first_name.find(":")
    first_name = first_name[:pos]

    global second_name
    second_name = second_line[20:]
    pos = second_name.find(":")
    second_name = second_name[:pos]
    while first_name == second_name:
        i += 1
        second_line = conv_file[i]
        second_name = second_line[20:]
        pos = second_name.find(":")
        second_name = second_name[:pos]


def get_msg_list(conv_text):
    out = []
    first = True
    i = -1
    conv_text = conv_text[1:]
    for line in conv_text:
        i += 1
        if first_name in line:
            first = True
            out.append(line)
        elif second_name in line:
            first = False
            out.append(line)
        else:
            curr = out[i - 1]
            curr += line
            out[i - 1] = curr
            i -= 1

    return out


def count_words(line, name):
        curr = line[len(name) + 22:]
        if " " in curr:
            curr = curr.split()
            return len(curr)
        return 1


def de_emojify(input_string):
    return input_string.encode('ascii', 'ignore').decode('ascii').strip(".").strip(",").strip("?").strip("!")\
        .strip(":").strip(";").strip("(").strip(")").strip("-")


def most_common_words(file):
    words = {}
    for line in file:
        if first_name in line:
            line = line[22 + len(first_name):]
        else:
            line = line[22 + len(second_name):]
        line = line.split()
        for word in line:
            word = de_emojify(word)
            if word == "":
                continue
            word = word.lower()
            if word in words:
                words[word] = words[word] + 1
            else:
                words[word] = 1
    return words


def main():
    # Get some input from the user about the details of the text file.
    file_name = input("Enter the name of the text file:\n")

    with io.open(file_name, "r", encoding = "utf-8") as text:
        conv_msg = text.readlines()

    # Extracting chat names from text file.
    extract_names(conv_msg)
    conv_text = get_msg_list(conv_msg)
    words = most_common_words(conv_text)
    text.close()

    print("\n===========================================================================================\n")
    print("WhatsApp chat statistics for conversation between {} and {}".format(first_name, second_name))
    print("\n===========================================================================================\n")

    first_total_messages = 0
    second_total_messages = 0
    first_total_words = 0
    second_total_words = 0
    count = 0
    for line in conv_text:
        num_words = 0
        if "<Media omitted>" not in line:
            if first_name in line:
                count += 1
                first_total_messages += 1
                num_words = count_words(line, first_name)
                first_total_words += num_words
            elif second_name in line:
                count += 1
                second_total_messages += 1
                num_words = count_words(line, second_name)
                second_total_words += num_words

    print("{:6} total messages.\n".format(count))

    print("{:6} total messages for {}.".format(first_total_messages, first_name))
    print("{:6} total messages for {}.\n".format(second_total_messages, second_name))

    print("{:6} total words for {}.".format(first_total_words, first_name))
    print("{:6} total words for {}.\n".format(second_total_words, second_name))

    print("{:2.2f} average message length for {}.".format(first_total_words / first_total_messages, first_name))
    print("{:2.2f} average message length for {}.\n".format(second_total_words / second_total_messages, second_name))

    print("Top 20 most used words:")
    words.pop("<media")
    words.pop("omitted>")
    for i in range(20):
        high = max(words.values())
        curr = list(words.keys())[list(words.values()).index(high)]
        print("{:2}. {:10} ({})".format(i + 1, curr, high))
        words.pop(curr)


if __name__ == '__main__':
    main()
