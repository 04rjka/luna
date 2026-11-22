from typing import Optional
class Retriever:
    def __init__(self, vectorstore, k: int = 5):
        self.vectorstore = vectorstore
        self.k = k

    def retrieve(self, question,user_id:int,document_id:Optional[int]):

        if document_id:
            where_filter = {
                            "$and":[
                                {"user_id":user_id},
                                {"document_id":document_id}
                            ]
                        }
        else:
            where_filter = {"user_id":user_id}
            

        retriever = self.vectorstore.as_retriever(
            search_kwargs={
                "k":self.k,
                "filter": where_filter
            }
        )
        return retriever.invoke(question)

    # def retrieve_for_bot(self, question, bot_id: int, min_score: float = 0.3):
    #     results = self.vectorstore.similarity_search_with_relevance_scores(
    #     question, k=self.k, filter={"bot_id": bot_id})

    #     return [doc for doc, score in results if score >= min_score]

    def retrieve_for_bot(self, question, bot_id: int):
        retriever = self.vectorstore.as_retriever(
        search_kwargs={"k": self.k, "filter": {"bot_id": bot_id}}
    )
        return retriever.invoke(question)