# chatbot_rag.py
import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableWithMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.chat_history import InMemoryChatMessageHistory

class PotatoMarketChatbot:
    def __init__(self, api_key, pdf_path=None, persist_directory=None):
        self.api_key = api_key
        self.pdf_path = pdf_path or "potato_market_guide.pdf"  # 기본 PDF 파일 경로
        self.persist_directory = persist_directory or "vector_db"
        self.vector_store = None
        self.chain_with_memory = None
        self.chat_histories = {}  # 세션별 대화 기록 저장
        
        # 벡터 DB 초기화
        self.initialize_vector_db()
        
        # 챗봇 체인 초기화
        self.initialize_chatbot_chain()
    
    def initialize_vector_db(self):
        """벡터 데이터베이스 초기화"""
        try:
            # PDF 파일이 존재하는지 확인
            if not os.path.exists(self.pdf_path):
                print(f"PDF 파일을 찾을 수 없습니다: {self.pdf_path}")
                raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {self.pdf_path}")
            
            # 문서 로드 및 텍스트 분할
            loader = PyPDFLoader(self.pdf_path)
            documents = loader.load()
            
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, 
                chunk_overlap=200
            )
            chunks = text_splitter.split_documents(documents)
            print(f"분할된 청크 수: {len(chunks)}")
            
            # 임베딩 생성과 DB 적재
            embedding_function = OpenAIEmbeddings(api_key=self.api_key)
            
            self.vector_store = Chroma.from_documents(
                documents=chunks,
                embedding=embedding_function,
                persist_directory=self.persist_directory,
            )
            print(f"문서의 수: {self.vector_store._collection.count()}")
            
        except Exception as e:
            print(f"벡터 DB 초기화 오류: {e}")
            raise e
    
    
    def initialize_chatbot_chain(self):
        """챗봇 체인 초기화"""
        try:
            # 검색기 생성
            retriever = self.vector_store.as_retriever(search_kwargs={"k": 3})
            
            # 프롬프트 템플릿 설정
            template = """당신은 감자마켓 고객센터 전문가입니다. 
            다음 정보를 바탕으로 사용자의 질문에 친절하고 정확하게 답변해주세요.
            
            컨텍스트: {context}
            
            답변 시 주의사항:
            - 감자마켓 관련 질문에만 답변하세요
            - 모르는 내용은 솔직히 모른다고 말하세요
            - 친근하고 도움이 되는 톤으로 답변하세요
            - 구체적인 단계별 안내를 제공하세요

            예시1
            Q: 배고파
            A: 감자마켓과 관련된 질문이 아닙니다.

            예시2
            Q: 감자마켓 거래시 배송 방법 종류
            A: 감자마켓 거래시 배송 방법은 다음과 같습니다.
            - CU편의점 택배
            - GS편의점 택배
            - 7ELEVEN 택배
            - 우체국 택배           
            
            """
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", template),
                ("placeholder", "{chat_history}"),
                ("human", "{question}")
            ])
            
            # 모델 설정
            model = ChatOpenAI(
                model_name="gpt-4o-mini", 
                temperature=0, 
                api_key=self.api_key
            )
            
            # 문서 포맷팅 함수
            def format_docs(docs):
                return "\n\n".join(doc.page_content for doc in docs)
            
            # 체인 구성
            chain = (
                RunnablePassthrough.assign(
                    context=lambda x: format_docs(retriever.invoke(x["question"]))
                )
                | prompt
                | model
                | StrOutputParser()
            )
            
            # 메모리 설정
            self.chain_with_memory = RunnableWithMessageHistory(
                chain,
                lambda session_id: self.get_chat_history(session_id),
                input_messages_key="question",
                history_messages_key="chat_history",
            )
            
        except Exception as e:
            print(f"챗봇 체인 초기화 오류: {e}")
            self.chain_with_memory = None
    
    def get_chat_history(self, session_id):
        """세션별 대화 기록 반환"""
        if session_id not in self.chat_histories:
            self.chat_histories[session_id] = InMemoryChatMessageHistory()
        return self.chat_histories[session_id]
    
    def chat(self, question, session_id="default"):
        """챗봇과 대화"""
        try:
            if not self.chain_with_memory:
                return "죄송합니다. 챗봇이 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
            
            response = self.chain_with_memory.invoke(
                {"question": question},
                {"configurable": {"session_id": session_id}}
            )
            
            return response
            
        except Exception as e:
            print(f"챗봇 응답 오류: {e}")
            return "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    
    def clear_session(self, session_id="default"):
        """세션 대화 기록 초기화"""
        if session_id in self.chat_histories:
            del self.chat_histories[session_id]
        return True

# 전역 챗봇 인스턴스
chatbot_instance = None

def initialize_chatbot(api_key, pdf_path=None, persist_directory=None):
    """챗봇 초기화"""
    global chatbot_instance
    chatbot_instance = PotatoMarketChatbot(api_key, pdf_path, persist_directory)
    return chatbot_instance

def get_chatbot():
    """챗봇 인스턴스 반환"""
    return chatbot_instance
