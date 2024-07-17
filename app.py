import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import whisper
import tempfile
import base64

from deep_translator import GoogleTranslator
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain.prompts import PromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.llms import CTransformers
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain.chains import ConversationalRetrievalChain
from langchain_groq import ChatGroq

load_dotenv()
groq_api_key = os.environ['GROQ_API_KEY']
DB_FAISS_PATH = 'vectorstore/db_faiss'
DATA_PATH = 'data/'

custom_prompt_template = """Use the following pieces of information to answer the user's question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.

Context: {context}
Question: {question}

Only return the helpful answer below and nothing else.
"""

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

model = whisper.load_model("base")

qa_chain = None

def set_custom_prompt():
    prompt = PromptTemplate(template=custom_prompt_template, input_variables=['context', 'question'])
    return prompt

def retrieval_qa_chain(llm, prompt, db):
    message_history = ChatMessageHistory()
    memory = ConversationBufferMemory(
        memory_key="chat_history",
        output_key="answer",
        chat_memory=message_history,
        return_messages=True,
    )

    qa_chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        chain_type="stuff",
        retriever=db.as_retriever(search_kwargs={'k': 2}),
        memory=memory,
        return_source_documents=False,
    )
    return qa_chain

def load_llm():
    llm = ChatGroq(
        groq_api_key=groq_api_key,
        model_name='mixtral-8x7b-32768'
    )
    return llm

def initialize_qa_bot(plant_type):
    global qa_chain
    try:
        print("Initializing embeddings...")
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'}
        )
        faiss_index_path = f"{DB_FAISS_PATH}_{plant_type}"

        if not os.path.exists(faiss_index_path):
            print(f"FAISS database for {plant_type} does not exist. Creating a new one...")
            update_qa_bot(plant_type)
            return

        print(f"Loading FAISS database for {plant_type}...")
        db = FAISS.load_local(faiss_index_path, embeddings, allow_dangerous_deserialization=True)
        print("Loading LLM...")
        llm = load_llm()
        print("Setting custom prompt...")
        qa_prompt = set_custom_prompt()
        print("Creating QA chain...")
        qa_chain = retrieval_qa_chain(llm, qa_prompt, db)
        print("QA chain created successfully.")
    except Exception as e:
        print(f"Error in initialize_qa_bot: {str(e)}")

def update_qa_bot(plant_type):
    global qa_chain
    try:
        print(f"Updating vector store and QA chain for {plant_type}...")
        loader = DirectoryLoader(f"{DATA_PATH}{plant_type}/", glob='*.pdf', loader_cls=PyPDFLoader)
        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        texts = text_splitter.split_documents(documents)

        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2", model_kwargs={'device': 'cpu'})
        db = FAISS.from_documents(texts, embeddings)
        db.save_local(f"{DB_FAISS_PATH}_{plant_type}")

        llm = load_llm()
        qa_prompt = set_custom_prompt()
        qa_chain = retrieval_qa_chain(llm, qa_prompt, db)
        print("Vector store and QA chain updated successfully.")
    except Exception as e:
        print(f"Error in update_qa_bot: {str(e)}")



def translate_to_kannada(text):
    try:
        translated = GoogleTranslator(source='auto', target='kn').translate(text)
        return translated
    except Exception as e:
        print(f"Error in translate_to_kannada: {str(e)}")
        return text

def translate_to_english(text):
    try:
        translated = GoogleTranslator(source='kn', target='en').translate(text)
        return translated
    except Exception as e:
        print(f"Error in translate_to_english: {str(e)}")
        return text
    
@app.route('/api/chat', methods=['POST'])
def chat():
    global qa_chain
    if qa_chain is None:
        return jsonify({'reply': 'Error initializing QA bot'}), 500

    user_message = request.json.get('message')
    language = request.json.get('language', 'en')

    # Predefined responses for greetings and common questions
    predefined_responses = {
        "hi": "Hello! How can I assist you today?",
        "hello": "Hi there! How can I help you?",
        "bye": "Goodbye! Have a great day!",
        "who are you": "I am the Coastal Crop Assistant Bot. I can provide information about Arecanut, Coconut, Cashew, and Cocoa plants.",
        "how are you": "I'm just a bot, but I'm here to help you with any questions you have about Arecanut, Coconut, Cashew, and Cocoa plants."
    }


    # Check for predefined responses
    lower_message = user_message.lower().strip()
    if lower_message in predefined_responses:
        reply = predefined_responses[lower_message]
    elif any(keyword in lower_message for keyword in ['price', 'cost', 'rate']):
        reply = 'You can get the price details at this link: <a href="https://news.suddimahithi.com/puttur/" target="_blank">Suddimahithi Puttur</a>. You will find the prices either on the 2nd or 3rd page of this newspaper. Note: Prices are not available on Sunday and Monday.'
    else:
        try:
            if language == 'kn':
                user_message = translate_to_english(user_message)

            response = qa_chain.invoke({'question': user_message})
            reply = response['answer']

            if language == 'kn':
                reply = translate_to_kannada(reply)

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'reply': reply})


@app.route('/api/chat/check_initialization', methods=['GET'])
def check_initialization():
    global qa_chain
    initialized = qa_chain is not None
    return jsonify({'initialized': initialized})

@app.route('/api/chat/update', methods=['POST'])
def update_chatbot():
    plant_type = request.json.get('plant_type')
    update_qa_bot(plant_type)
    return jsonify({'status': 'QA bot updated successfully'})

@app.route('/api/chat/select_plant', methods=['POST'])
def select_plant():
    plant_type = request.json.get('plant_type')
    initialize_qa_bot(plant_type)
    return jsonify({'status': f'QA bot initialized for {plant_type} successfully'})

@app.route('/api/chat/reset', methods=['POST'])
def reset_chatbot():
    global qa_chain
    qa_chain = None
    return jsonify({'status': 'QA bot reset successfully'})

@app.route('/api/voice', methods=['POST'])
def voice_to_text():
    try:
        audio_data = request.json.get('audio')
        audio_bytes = base64.b64decode(audio_data.split(",")[1])

        with tempfile.NamedTemporaryFile(delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio_path = temp_audio.name

        result = model.transcribe(temp_audio_path)
        os.remove(temp_audio_path)
        return jsonify({'text': result['text']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/weather.html')
def weather():
    return render_template('weather.html')

if __name__ == '__main__':
    app.run(port=5000)


