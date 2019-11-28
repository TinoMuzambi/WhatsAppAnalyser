# WhatsApp Analyser
# Tino Muzambi
# 26 November 2019
import io

first_name = ""
second_name = ""


def extract_names(conv_file):
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


def count_words(line, name):
        curr = line[len(name) + 22:]
        if " " in curr:
            curr = curr.split()
            return len(curr)
        return 1


def main():
    # Get some input from the user about the details of the text file.
    file_name = input("Enter the name of the text file:\n")

    with io.open(file_name, "r", encoding = "utf-8") as text:
        conv_text = text.readlines()
    text.close()

    # Debug code
    with io.open("line of text.txt", "w", encoding="utf-8") as out_file:
        count1 = 0
        for i in conv_text:
            count1 += 1
            print(str(count1) + " " + i.strip("\n"), file = out_file)
    out_file.close()

    # Extracting chat names from text file.
    extract_names(conv_text)

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
    print("{:2.2f} average message length for {}.".format(second_total_words / second_total_messages, second_name))


if __name__ == '__main__':
    main()
